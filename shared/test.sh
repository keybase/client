#!/bin/bash

test_type = "$1"
commit_hash = "$2"

check_rc() {
  # exit if passed in value is not = 0
  # $1 = check return code
  # $2 = command / label
  # $3 = exit code
  if [ $1 -ne 0 ]
  then
    echo "$2: bailing"
    exit $3
  fi
}

has_js_files() {
    echo 'git fetch'
    git fetch
    check_rc $? 'echo git fetch problem' 1
    echo 'git diff'
    echo "merge target is $2"
    diff_files=`git diff --name-only ${2}...${commit_hash} | grep '^shared/'`
    check_rc $? 'no files js cares about' 0
    echo "continuing due to changes in ${diff_files}"
}

js_tests() {
    echo 'js-tests'
    node --version
    has_js_files

    yarn install --pure-lockfile --prefer-offline --no-emoji --no-progress
    check_rc $? 'yarn install fail' 1
    yarn run flow
    check_rc $? 'yarn run flow' 1
    yarn run lint
    check_rc $? 'yarn run lint fail' 1
    yarn test
    check_rc $? 'yarn test fail' 1
}

visdiff() {
    echo 'visdiff'
    has_js_files
    node ../visdiff/dist/index.js $2
    check_rc $? 'visdiff fail' 1
}

visdiff_install() {
    echo 'visdiff-install'
    has_js_files
    yarn install --pure-lockfile
    check_rc $? 'visdiff fail' 1
}

if [ $test_type == 'visdiff' ]; then
    visdiff
elif [ $test_type == 'visdiff-install' ]; then
    visdiff_install
else
    js_tests
fi
