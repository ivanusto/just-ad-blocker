"""Bump the patch version in src/manifest.json.template.

Prints the new version to stdout, and appends `version=<new>` to $GITHUB_OUTPUT
when running inside GitHub Actions.
"""

import os
import re

TEMPLATE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'src', 'manifest.json.template'
)


def main():
    s = open(TEMPLATE, encoding='utf-8').read()
    m = re.search(r'"version":\s*"(\d+)\.(\d+)\.(\d+)"', s)
    if not m:
        raise SystemExit('version field not found in manifest template')
    major, minor, patch = map(int, m.groups())
    new_version = f'{major}.{minor}.{patch + 1}'
    s = s[:m.start()] + f'"version": "{new_version}"' + s[m.end():]
    with open(TEMPLATE, 'w', encoding='utf-8') as f:
        f.write(s)

    github_output = os.environ.get('GITHUB_OUTPUT')
    if github_output:
        with open(github_output, 'a', encoding='utf-8') as f:
            f.write(f'version={new_version}\n')
    print(new_version)


if __name__ == '__main__':
    main()
