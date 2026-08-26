#!/usr/bin/env python3
"""Unit checks for the filter-list to declarativeNetRequest converter.

Focused on the two ABP modifiers that used to be mishandled:

  * `$badfilter`, which exists only to cancel an identical filter from another
    list, and used to be compiled into a live block rule.
  * `$important`, which outranks `@@` exceptions, and used to be ignored while
    every exception sat at a higher priority than every block.

Pure Python, no network and no browser. Run it with `python scripts/check_rules.py`.
"""

import os
import shutil
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import compile_rules as cr  # noqa: E402

FIXTURE_LIST = """\
! title=test list
||plain.example^
||cancelled.example^
||cancelled.example^$badfilter
||partial.example^$third-party
||partial.example^$script,third-party,badfilter
||partial.example^$script,third-party
||domainorder.example^$domain=b.example|a.example
||domainorder.example^$domain=a.example|b.example,badfilter
||importantblock.example^$important
@@||importantallow.example^$important
@@||plainallow.example^
/ads/banner.gif
/ads/banner.gif$badfilter
"""


def parsed(line):
    p = cr.parse_line(line)
    assert p is not None, f"parse_line rejected {line!r}"
    return p, cr.parse_options(p['options'])


def check_option_parsing(fail):
    _, opts = parsed("||a.example^$important")
    if not opts['important']:
        fail("$important should set the important flag")

    _, opts = parsed("||a.example^$badfilter")
    if not opts['badfilter']:
        fail("$badfilter should set the badfilter flag")

    _, opts = parsed("||a.example^$third-party")
    if opts['important'] or opts['badfilter']:
        fail("a plain rule should set neither flag")


def check_signatures(fail):
    # Option order must not matter, in either direction.
    a, _ = parsed("||x.example^$script,third-party")
    b, _ = parsed("||x.example^$third-party,script,badfilter")
    if cr.badfilter_signature(a) != cr.badfilter_signature(b):
        fail("option order should not change the badfilter signature")

    # Domain lists are compared as sets.
    a, _ = parsed("||x.example^$domain=b.example|a.example")
    b, _ = parsed("||x.example^$domain=a.example|b.example,badfilter")
    if cr.badfilter_signature(a) != cr.badfilter_signature(b):
        fail("domain order should not change the badfilter signature")

    # A different option set is a different filter.
    a, _ = parsed("||x.example^$script")
    b, _ = parsed("||x.example^$image,badfilter")
    if cr.badfilter_signature(a) == cr.badfilter_signature(b):
        fail("different options should not share a badfilter signature")

    # An exception is not the same filter as the block it mirrors.
    a, _ = parsed("||x.example^")
    b, _ = parsed("@@||x.example^$badfilter")
    if cr.badfilter_signature(a) == cr.badfilter_signature(b):
        fail("@@ and a plain block should not share a badfilter signature")


def check_priorities(fail):
    cases = [
        ("||x.example^", cr.PRIORITY_BLOCK),
        ("@@||x.example^", cr.PRIORITY_ALLOW),
        ("||x.example^$important", cr.PRIORITY_IMPORTANT_BLOCK),
        ("@@||x.example^$important", cr.PRIORITY_IMPORTANT_ALLOW),
    ]
    for line, expected in cases:
        p, opts = parsed(line)
        got = cr.rule_priority(p, opts)
        if got != expected:
            fail(f"{line!r} should be priority {expected}, got {got}")

    if not (cr.PRIORITY_IMPORTANT_BLOCK > cr.PRIORITY_ALLOW > cr.PRIORITY_BLOCK):
        fail("an $important block must outrank an exception, which outranks a block")
    if cr.PRIORITY_IMPORTANT_ALLOW <= cr.PRIORITY_IMPORTANT_BLOCK:
        fail("an $important exception must outrank an $important block")

    p, opts = parsed("||x.example^$important")
    if cr.is_pure_domain_block(p, opts):
        fail("an $important domain block must not be merged into a shared chunk")


def check_end_to_end(fail):
    """Compile the fixture list and look at what came out."""
    tmp = tempfile.mkdtemp(prefix="jab-rules-")
    original_cache = cr.CACHE_DIR
    try:
        cr.CACHE_DIR = tmp
        with open(os.path.join(tmp, "fixture.txt"), "w", encoding="utf-8") as f:
            f.write(FIXTURE_LIST)
        rules = cr.compile_ruleset("fixture", [{
            "name": "fixture",
            "url": "http://invalid.invalid/never-fetched.txt",
            "cache": "fixture.txt",
        }])
    finally:
        cr.CACHE_DIR = original_cache
        shutil.rmtree(tmp, ignore_errors=True)

    chunked = set()
    filters = {}
    for r in rules:
        c = r["condition"]
        chunked.update(c.get("requestDomains", []))
        key = c.get("urlFilter")
        if key:
            filters.setdefault(key, []).append((r["priority"], r["action"]["type"]))

    def blocked(domain):
        return domain in chunked or f"||{domain}^" in filters

    if not blocked("plain.example"):
        fail("an ordinary domain block should survive")
    if blocked("cancelled.example"):
        fail("||cancelled.example^ should have been cancelled by its $badfilter")
    if blocked("domainorder.example"):
        fail("$badfilter should match despite a reordered $domain= list")
    if "/ads/banner.gif" in filters:
        fail("a path filter should be cancelled by its $badfilter")

    # Only the exact option set named by the $badfilter is cancelled.
    partial = [r for r in rules
               if r["condition"].get("urlFilter") == "||partial.example^"]
    kinds = {tuple(sorted(r["condition"].get("resourceTypes", []))) for r in partial}
    if len(partial) != 1:
        fail(f"only the $script,$third-party variant should be cancelled, got {partial}")
    elif len(kinds.pop()) == 1:
        fail("the wrong ||partial.example^ variant was cancelled")

    imp = filters.get("||importantblock.example^", [])
    if imp != [(cr.PRIORITY_IMPORTANT_BLOCK, "block")]:
        fail(f"$important block should be an own priority-3 rule, got {imp}")
    if "importantblock.example" in chunked:
        fail("$important block leaked into the shared domain chunk")

    imp_allow = filters.get("||importantallow.example^", [])
    if imp_allow != [(cr.PRIORITY_IMPORTANT_ALLOW, "allow")]:
        fail(f"$important exception should be priority 4, got {imp_allow}")

    plain_allow = filters.get("||plainallow.example^", [])
    if plain_allow != [(cr.PRIORITY_ALLOW, "allow")]:
        fail(f"a plain exception should stay at priority 2, got {plain_allow}")


def main():
    failures = []

    def fail(message):
        failures.append(message)

    for check in (check_option_parsing, check_signatures,
                  check_priorities, check_end_to_end):
        check(fail)

    if failures:
        print("FAIL")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("PASS: $badfilter cancels its target, $important outranks exceptions")
    return 0


if __name__ == "__main__":
    sys.exit(main())
