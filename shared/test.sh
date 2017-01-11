#!/bin/bash

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

node --version
echo 'git fetch'
git fetch
check_rc $? 'echo git fetch problem' 1
echo 'git diff'
merge_base=`git merge-base origin/master HEAD`
diff_files=`git diff --name-only ${merge_base} | grep '^shared/'`
check_rc $? 'no files js cares about' 0

echo 'running js tests'
yarn install --pure-lockfile --verbose --prefer-offline --no-emoji --no-progress
check_rc $? 'yarn install fail' 1
yarn run flow
check_rc $? 'yarn run flow' 1
yarn run lint
check_rc $? 'yarn run lint fail' 1
yarn test
check_rc $? 'yarn test fail' 1
