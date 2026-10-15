#!/usr/bin/env bash
# starts up the RN packager & requests both ios and android bundles

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir/.. # we're in /shared/

arg1=${1:-}
arg2=${2:-}
checkArg ()
{
  # check if arg is bound
  if [ -x ${1+x} ]; then
    return
  fi
  case $1 in
    "ios"|"android"|"")
      ;;
    *)
      echo "Invalid build type '$1'. Valid types are 'ios' and 'android'." >&2
      exit 1;;
  esac
}
checkArg $arg1
checkArg $arg2

requestbundles ()
{
  if [ "$arg1" == "" ]; then
    return
  fi
  printf "\nRequesting bundles...\n"
  if [ "$arg1" == "ios" ] || [ "$arg2" == "ios" ]; then
    curl -s -o /dev/null "localhost:8081/index.bundle?platform=ios&dev=true&minify=false" 2>&1 || true
  fi
  if [ "$arg1" == "android" ] || [ "$arg2" == "android" ]; then
    curl -s -o /dev/null "localhost:8081/index.bundle?platform=android&dev=true&minify=false" 2>&1 || true
  fi
}

# start in background so we get the bundler dashboard
sleep 5 && requestbundles &
backgroundpid=$!
trap 'kill $backgroundpid' EXIT # quit requestBundles on exit
while true; do
  npx expo start --clear
done
