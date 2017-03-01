#!/bin/bash

commit_hash="$1"
change_target="origin/$2"

if [ "$2" == "null" ]; then
    against_master=1
else
    against_master=0
    change_base=$(git merge-base $change_target $commit_hash)
fi

echo "tests/jenkins_test.sh recieved commit_hash: ${commit_hash} change_target: ${change_target} change_base: ${change_base}"

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

has_go_files() {
    if [ $against_master -eq 1 ]; then
        echo 'Missing $change_target, forcing has_go_files to true'
        return
    fi
    echo 'git fetch'
    git fetch
    check_rc $? 'echo git fetch problem' 1
    echo 'git diff'
    git diff --name-only "$change_base...$commit_hash"
    # ignore test.sh for now
    diff_files=`git diff --name-only "$change_base...$commit_hash" | grep -v '^shared/'`
    check_rc $? 'no files go cares about' 0
    echo "continuing due to changes in $diff_files"
}

go_tests() {
    echo 'go-tests'
    has_go_files

    echo './test/run_tests.sh'
    ./test/run_tests.sh
    check_rc $? 'run_test.sh fail' 1
}

go_tests
