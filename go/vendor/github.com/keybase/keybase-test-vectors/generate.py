#!/usr/bin/env python3

# Requires Python 3.4.
from pathlib import Path

root = Path(__file__).parent
chains_dir = root / "chains"
chain_tests_file = root / "chain_tests.json"
chain_files = list(chains_dir.glob("*.json"))

# Generate JS

js_dir = root / "js"
if not js_dir.is_dir():
    js_dir.mkdir()
js_file = js_dir / "main.js"

with js_file.open("w") as f:
    f.write("exports.chain_tests = require('../chain_tests.json');\n")
    f.write("exports.chain_test_inputs = {};\n")
    for chain_file in chain_files:
        f.write("exports.chain_test_inputs['{0}'] = "
                "require('../chains/{0}');\n"
                .format(chain_file.name))

# Generate Go

go_dir = root / "go"
if not go_dir.is_dir():
    go_dir.mkdir()
go_file = go_dir / "testvectors.go"


def make_go_string_literal(string_contents):
    # Go does not allow escaping backticks in a backtick-delimited string. So
    # we need to terminate the string, insert a backtick in double quotes, and
    # then reopen the string.
    escaped = string_contents.replace('`', '`+"`"+`')
    return '`' + escaped + '`'

with go_file.open("w") as f:
    f.write("package testvectors\n")
    f.write("\n")
    f.write("const ChainTests = `\n")
    with chain_tests_file.open() as tests_f:
        f.write(tests_f.read())
    f.write("`\n")
    f.write("\n")
    f.write("var ChainTestInputs = map[string]string{\n")
    for chain_file in chain_files:
        with chain_file.open() as chain_f:
            f.write('\t"{}": {},\n'.format(
                chain_file.name, make_go_string_literal(chain_f.read())))
    f.write("}\n")
