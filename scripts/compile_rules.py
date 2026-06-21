"""Compile Adblock-Plus style filter lists into Manifest V3
declarativeNetRequest (DNR) rulesets.

This converter is deliberately conservative: every rule it emits is
validated before being written, so a single malformed source line can
never poison an entire ruleset (which would make Chrome reject the whole
extension with "Could not load manifest").

Output rulesets:
  - rules_core.json   : AdGuard DNS filter + EasyList   (global ad/tracker blocking)
  - rules_china.json  : AdRules                          (Chinese/Asian sites)
"""

import os
import re
import sys
import json
import urllib.request

# Ensure UTF-8 encoding for stdout on Windows
try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

# --- Portable paths (resolved relative to this script) ---------------------
SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
WORKSPACE_DIR = os.path.dirname(SCRIPTS_DIR)
SRC_DIR = os.path.join(WORKSPACE_DIR, 'src')
RULES_OUT_DIR = os.path.join(SRC_DIR, 'rulesets')
CACHE_DIR = os.path.join(SCRIPTS_DIR, '.cache')

os.makedirs(RULES_OUT_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)

# --- Source lists ----------------------------------------------------------
# Each output ruleset is built by merging one or more upstream filter lists.
#
# To use ONLY EasyList for the core ruleset (simpler, fewer rules, but loses the
# ~159k tracker/malware domains from the AdGuard DNS filter), just delete the
# 'adguard_dns' entry below and keep 'easylist'.
RULESETS = {
    'rules_core.json': [
        {
            'name': 'adguard_dns',
            'url': 'https://adguardteam.github.io/HostlistsRegistry/assets/filter_1.txt',
            'cache': 'filter_1_adguard_dns.txt',
        },
        {
            'name': 'easylist',
            'url': 'https://easylist.to/easylist/easylist.txt',
            'cache': 'easylist.txt',
        },
    ],
    'rules_china.json': [
        {
            'name': 'adrules',
            'url': 'https://adguardteam.github.io/HostlistsRegistry/assets/filter_29.txt',
            'cache': 'filter_29_adrules.txt',
        },
    ],
}

# All declarativeNetRequest resource types (used when a rule has no $type option).
RESOURCE_TYPES = [
    "main_frame", "sub_frame", "stylesheet", "script", "image",
    "font", "object", "xmlhttprequest", "ping", "csp_report",
    "media", "websocket", "other",
]

# Maximum static rules we allow per ruleset. Chrome guarantees 30,000 enabled
# static rules; we stay comfortably under that.
MAX_RULES_PER_SET = 28000

# ABP resource-type option -> DNR resource type.
RES_MAP = {
    'script': 'script',
    'image': 'image',
    'stylesheet': 'stylesheet',
    'css': 'stylesheet',
    'object': 'object',
    'object-subrequest': 'object',
    'subdocument': 'sub_frame',
    'document': 'main_frame',
    'doc': 'main_frame',
    'xmlhttprequest': 'xmlhttprequest',
    'xhr': 'xmlhttprequest',
    'ping': 'ping',
    'beacon': 'ping',
    'websocket': 'websocket',
    'media': 'media',
    'font': 'font',
    'other': 'other',
}

# Options that change the action in a way DNR can't express here -> drop the rule.
UNSUPPORTED_ACTION_OPTS = {
    'redirect', 'redirect-rule', 'removeparam', 'removeheader', 'csp',
    'replace', 'cookie', 'empty', 'mp4', 'rewrite', 'header', 'permissions',
    'inline-script', 'inline-font', 'urltransform', 'hls', 'jsonprune',
    'stealth', 'app', 'method', 'to',
}

# Cosmetic-only modifiers (no network effect) -> drop the rule.
COSMETIC_OPTS = {
    'elemhide', 'generichide', 'specifichide', 'ghide', 'shide', 'content',
}

# RE2 (Chrome's regex engine) does NOT support these constructs.
RE2_UNSUPPORTED = re.compile(r'\(\?<|\(\?=|\(\?!|\(\?>|\\[1-9]|\*\+|\+\+|\?\+')

# Chrome skips any regexFilter whose compiled form exceeds ~2KB of memory.
# We can't run RE2 here, so we estimate the cost from bounded quantifiers
# (which the engine unrolls) and drop regexes that are too heavy.
MAX_REGEX_COST = 100
_QUANT = re.compile(r'\{(\d+)(,(\d*))?\}')


def _atom_cost(pattern, idx):
    """Approximate per-repetition cost of the atom preceding a quantifier at idx."""
    if idx <= 0:
        return 1
    prev = pattern[idx - 1]
    if prev == '.':
        return 10            # '.' is an expensive any-char class
    if prev == ']':
        return 4             # character class [...]
    if prev == ')':
        return 5             # group
    if idx >= 2 and pattern[idx - 2] == '\\':
        c = prev.lower()
        if c == 'w':
            return 8
        if c == 's':
            return 6
        if c == 'd':
            return 4
        return 1             # escaped literal
    return 1                 # plain literal


def regex_expansion_cost(pattern):
    cost = 0
    for m in _QUANT.finditer(pattern):
        n = int(m.group(1))
        count = (int(m.group(3)) if m.group(3) else n) if m.group(2) else n
        cost += count * _atom_cost(pattern, m.start())
    return cost


def regex_total_cost(pattern):
    """Estimate the compiled RE2 program size. Includes a structural/base term
    (so long alternations like '(club|bid|xyz|...)' are accounted for) plus the
    quantifier-expansion term. Used to stay under Chrome's 2KB regex limit."""
    base = 0
    i, n = 0, len(pattern)
    while i < n:
        ch = pattern[i]
        if ch == '\\':
            if i + 1 < n:
                base += 4 if pattern[i + 1] in 'wWsSdD' else 1
                i += 2
            else:
                base += 1
                i += 1
        elif ch == '[':
            j = pattern.find(']', i + 1)
            j = n if j == -1 else j
            base += 6                       # character class
            i = j + 1
        elif ch == '.':
            base += 10                      # any-char class is expensive
            i += 1
        elif ch == '{':
            j = pattern.find('}', i)
            i = (j + 1) if j != -1 else i + 1
        elif ch in '*+?^$(|)':
            i += 1                          # cheap operators
        else:
            base += 1                       # literal
            i += 1
    return base + regex_expansion_cost(pattern)

VALID_DOMAIN = re.compile(r'^[a-z0-9.\-_]+$')
# A single DNS label that Chrome/Firefox accept inside requestDomains.
DOMAIN_LABEL = re.compile(r'^[a-z0-9-]{1,63}$')


def is_valid_request_domain(d):
    """Whether a host is acceptable in a DNR `requestDomains` list. Rejects
    underscores and IP-like hosts (numeric TLD), which Firefox refuses; those
    are routed to a urlFilter rule instead."""
    if not d or not d.isascii() or '.' not in d:
        return False
    labels = d.split('.')
    if not all(DOMAIN_LABEL.match(lbl) for lbl in labels):
        return False
    # A numeric final label means this is an IP fragment, not a real domain.
    if not any(ch.isalpha() for ch in labels[-1]):
        return False
    return True


def download_list(name, url, cache_path):
    print(f"Downloading {name} from {url} ...")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
        with open(cache_path, 'wb') as f:
            f.write(data)
        print(f"  saved {len(data)} bytes")
    except Exception as e:
        if os.path.exists(cache_path):
            print(f"  download failed ({e}); using cached copy")
        else:
            raise


def clean_domain(raw):
    """Normalise a bare-domain token. Returns punycode domain or None."""
    domain = raw.strip().lower()
    if domain.startswith('||'):
        domain = domain[2:]
    if domain.endswith('^'):
        domain = domain[:-1]
    domain = domain.strip('.')
    if not domain:
        return None
    try:
        domain = domain.encode('idna').decode('ascii')
    except Exception:
        return None
    if '.' not in domain or not VALID_DOMAIN.match(domain):
        return None
    return domain


def parse_line(raw):
    """Parse one ABP filter line into a dict, or None to skip."""
    line = raw.strip()
    if not line or line[0] in '!#[':
        return None
    # Cosmetic / scriptlet filters (##, #@#, #?#, #$#, #%#) -> no DNR equivalent.
    if re.search(r'#[@?$%]?#', line):
        return None

    exception = line.startswith('@@')
    if exception:
        line = line[2:]

    is_regex = False
    pattern = line
    options = ''

    if line.startswith('/'):
        m = re.match(r'^/(.+?)/(?:\$(.*))?$', line)
        if m:
            is_regex = True
            pattern = m.group(1)
            options = m.group(2) or ''
    if not is_regex and '$' in line:
        idx = line.find('$')
        pattern = line[:idx]
        options = line[idx + 1:]

    pattern = pattern.strip()
    if not pattern:
        return None
    return {'regex': is_regex, 'pattern': pattern, 'options': options, 'exception': exception}


def parse_options(options):
    """Parse the $option string. Returns a dict or None if the rule must be dropped."""
    result = {
        'resource_types': [],
        'excluded_resource_types': [],
        'domains': [],
        'excluded_domains': [],
        'domain_type': None,  # 'thirdParty' | 'firstParty'
        'match_case': False,
    }
    if not options:
        return result

    for opt in options.split(','):
        opt = opt.strip()
        if not opt:
            continue
        neg = opt.startswith('~')
        key = opt[1:] if neg else opt

        if key.startswith('domain='):
            for d in key[len('domain='):].split('|'):
                d = d.strip().lower()
                if not d:
                    continue
                excl = d.startswith('~')
                d = d[1:] if excl else d
                try:
                    d = d.encode('idna').decode('ascii')
                except Exception:
                    continue
                if not VALID_DOMAIN.match(d):
                    continue
                (result['excluded_domains'] if excl else result['domains']).append(d)
            continue

        base = key.split('=', 1)[0]
        if base in UNSUPPORTED_ACTION_OPTS or base in COSMETIC_OPTS:
            return None  # can't represent -> drop rule
        if key in ('third-party', '3p'):
            result['domain_type'] = 'firstParty' if neg else 'thirdParty'
            continue
        if key in ('match-case',):
            result['match_case'] = True
            continue
        if key in ('important', 'popup', 'all', 'first-party', '1p', 'strict1p', 'strict3p'):
            # No precise DNR equivalent; ignore the modifier but keep the rule.
            continue
        if key in RES_MAP:
            (result['excluded_resource_types'] if neg else result['resource_types']).append(RES_MAP[key])
            continue
        # Unknown modifier: be lenient and ignore it.
    return result


def build_condition(opts):
    """Build the shared part of a DNR condition from parsed options."""
    cond = {}
    inc = sorted(set(opts['resource_types']))
    exc = sorted(set(opts['excluded_resource_types']))
    if inc:
        cond['resourceTypes'] = inc
    elif exc:
        cond['resourceTypes'] = [t for t in RESOURCE_TYPES if t not in exc]
    else:
        cond['resourceTypes'] = list(RESOURCE_TYPES)
    if opts['domain_type']:
        cond['domainType'] = opts['domain_type']
    if opts['domains']:
        cond['initiatorDomains'] = sorted(set(opts['domains']))
    if opts['excluded_domains']:
        cond['excludedInitiatorDomains'] = sorted(set(opts['excluded_domains']))
    if opts['match_case']:
        cond['isUrlFilterCaseSensitive'] = True
    return cond


def is_valid_regex(pattern):
    if not pattern or not pattern.isascii():
        return False
    if len(pattern) > 600:
        return False
    if RE2_UNSUPPORTED.search(pattern):
        return False
    if regex_total_cost(pattern) > MAX_REGEX_COST:
        return False  # would exceed Chrome's 2KB compiled-regex limit
    try:
        re.compile(pattern)
    except re.error:
        return False
    return True


def normalize_urlfilter(pattern):
    """Apply DNR-specific fixups. Chrome forbids a urlFilter starting with
    '||*'; replacing the domain anchor with a plain wildcard keeps the intent."""
    while pattern.startswith('||*'):
        pattern = pattern[2:]  # '||*foo' -> '*foo'
    return pattern


def is_valid_urlfilter(pattern):
    if not pattern:
        return False
    # Must be printable ASCII (no spaces/control/non-ascii).
    if any(not (33 <= ord(c) <= 126) for c in pattern):
        return False
    if pattern.startswith('||*'):  # Chrome rejects this outright.
        return False
    core = pattern.strip('|^*')
    if len(core) < 3:  # too generic / degenerate
        return False
    # '|' may only appear as a leading/trailing anchor (or '||' at the start).
    inner = pattern
    if inner.startswith('||'):
        inner = inner[2:]
    elif inner.startswith('|'):
        inner = inner[1:]
    if inner.endswith('|'):
        inner = inner[:-1]
    if '|' in inner:
        return False
    return True


def is_pure_domain_block(p, opts):
    """True if the rule is just '||domain^' with no extra conditions, so it can
    be merged into an efficient requestDomains chunk."""
    if p['exception'] or p['regex']:
        return False
    if opts['resource_types'] or opts['excluded_resource_types']:
        return False
    if opts['domains'] or opts['excluded_domains'] or opts['domain_type']:
        return False
    if not p['pattern'].startswith('||'):
        return False
    body = p['pattern'][2:]
    if body.endswith('^'):
        body = body[:-1]
    if any(c in body for c in '*/|^?='):
        return False
    cleaned = clean_domain(body)
    return cleaned is not None and is_valid_request_domain(cleaned)


def compile_ruleset(out_name, sources):
    print(f"\n=== Building {out_name} ===")
    domains = set()
    block_rules = []   # individual block rules (urlFilter/regexFilter)
    allow_rules = []   # exception rules
    seen = set()       # dedupe signatures

    stats = {'lines': 0, 'cosmetic': 0, 'dropped': 0, 'bad_regex': 0, 'bad_url': 0}

    for src in sources:
        cache_path = os.path.join(CACHE_DIR, src['cache'])
        if not os.path.exists(cache_path):
            download_list(src['name'], src['url'], cache_path)
        with open(cache_path, 'r', encoding='utf-8', errors='ignore') as f:
            for raw in f:
                stats['lines'] += 1
                p = parse_line(raw)
                if p is None:
                    continue
                opts = parse_options(p['options'])
                if opts is None:
                    stats['dropped'] += 1
                    continue

                if is_pure_domain_block(p, opts):
                    domains.add(clean_domain(p['pattern']))
                    continue

                cond = build_condition(opts)
                if p['regex']:
                    if not is_valid_regex(p['pattern']):
                        stats['bad_regex'] += 1
                        continue
                    cond['regexFilter'] = p['pattern']
                else:
                    url_pattern = normalize_urlfilter(p['pattern'])
                    if not is_valid_urlfilter(url_pattern):
                        stats['bad_url'] += 1
                        continue
                    cond['urlFilter'] = url_pattern

                action = 'allow' if p['exception'] else 'block'
                sig = (action, json.dumps(cond, sort_keys=True))
                if sig in seen:
                    continue
                seen.add(sig)
                rule = {'priority': 2 if p['exception'] else 1,
                        'action': {'type': action},
                        'condition': cond}
                (allow_rules if p['exception'] else block_rules).append(rule)

    # Chunk pure-domain blocks into requestDomains rules of 100 each.
    domain_rules = []
    domain_list = sorted(domains)
    for i in range(0, len(domain_list), 100):
        domain_rules.append({
            'priority': 1,
            'action': {'type': 'block'},
            'condition': {
                'requestDomains': domain_list[i:i + 100],
                'resourceTypes': list(RESOURCE_TYPES),
            },
        })

    # Assemble: allow rules first (highest value), then domain chunks, then path rules.
    assembled = allow_rules + domain_rules + block_rules
    if len(assembled) > MAX_RULES_PER_SET:
        print(f"  WARNING: {len(assembled)} rules exceeds cap {MAX_RULES_PER_SET}; trimming path rules")
        keep = MAX_RULES_PER_SET - len(allow_rules) - len(domain_rules)
        assembled = allow_rules + domain_rules + block_rules[:max(0, keep)]

    # Assign sequential ids.
    for idx, rule in enumerate(assembled, start=1):
        rule['id'] = idx

    # Final self-validation: guarantee every emitted rule is well-formed.
    validate_rules(assembled)

    out_path = os.path.join(RULES_OUT_DIR, out_name)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(assembled, f, indent=2)

    print(f"  source lines parsed : {stats['lines']}")
    print(f"  unique block domains: {len(domain_list)} -> {len(domain_rules)} chunk rules")
    print(f"  path/regex blocks   : {len(block_rules)} (dropped {stats['bad_regex']} bad regex, {stats['bad_url']} bad urlFilter)")
    print(f"  exception (allow)   : {len(allow_rules)}")
    print(f"  unsupported dropped : {stats['dropped']}")
    print(f"  TOTAL rules written : {len(assembled)} -> {out_path}")
    return len(assembled)


def validate_rules(rules):
    """Raise if any rule is malformed. This is the safety net that prevents
    shipping a ruleset Chrome would reject."""
    ids = set()
    for r in rules:
        rid = r['id']
        if rid in ids:
            raise ValueError(f"Duplicate rule id {rid}")
        ids.add(rid)
        c = r['condition']
        if 'regexFilter' in c and not is_valid_regex(c['regexFilter']):
            raise ValueError(f"Rule {rid} has invalid regexFilter: {c['regexFilter']!r}")
        if 'urlFilter' in c and not is_valid_urlfilter(c['urlFilter']):
            raise ValueError(f"Rule {rid} has invalid urlFilter: {c['urlFilter']!r}")
        for d in c.get('requestDomains', []):
            if not is_valid_request_domain(d):
                raise ValueError(f"Rule {rid} has invalid requestDomain: {d!r}")
        rt = c.get('resourceTypes')
        if rt is not None and not rt:
            raise ValueError(f"Rule {rid} has empty resourceTypes")


def main():
    for out_name, sources in RULESETS.items():
        compile_ruleset(out_name, sources)
    print("\n=== Rule compilation complete ===")


if __name__ == '__main__':
    main()
