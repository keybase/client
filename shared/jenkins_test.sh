#!/bin/bash

test_type="$1"
commit_hash="$2"
change_target="origin/$3"

if [ "$3" == "null" ]; then
    against_master=1
else
    against_master=0
    change_base=$(git merge-base $change_target $commit_hash)
fi

echo "shared/jenkins_test.sh recieved type: ${test_type} commit_hash: ${commit_hash} change_target: ${change_target} change_base: ${change_base}"

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
    if [ $against_master -eq 1 ]; then
        echo 'Missing $change_target, forcing has_js_files to true'
        return
    fi
    echo 'git fetch'
    git fetch
    check_rc $? 'echo git fetch problem' 1
    echo 'git diff'
    git diff --name-only "$change_base...$commit_hash"
    # ignore test.sh for now
    diff_files=`git diff --name-only "$change_base...$commit_hash" | grep '^shared/' | grep -v '^shared/jenkins_test\.sh'`
    check_rc $? 'no files js cares about' 0
    echo "continuing due to changes in $diff_files"
}

js_tests() {
    echo 'js-tests'
    node --version
    has_js_files

    echo 'yarn install'
    yarn modules
    check_rc $? 'yarn install fail' 1

    echo 'checking no mutated yarn.lock file'
    git diff --exit-code yarn.lock
    check_rc $? 'unexpected yarn.lock changes, did you forget to commit it? Do you have an inexact semver?' 1

    echo 'yarn build-actions'
    yarn build-actions
    check_rc $? 'yarn build-actions failed!' 1
    git diff --exit-code actions
    check_rc $? 'unexpected generated actions changes, did you forget to run yarn build-actions?' 1

    echo 'yarn tsc-slow'
    yarn tsc-slow
    check_rc $? 'tsc failed!' 1

    echo 'yarn lint'
    yarn lint
    check_rc $? 'yarn run lint fail' 1

    echo 'yarn test'
    yarn test
    check_rc $? 'yarn test fail' 1
}

js_tests
