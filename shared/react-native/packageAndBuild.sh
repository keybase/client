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
  case "ios" in
    $arg1|$arg2)
      curl -s -o /dev/null localhost:8081/index.ios.bundle 2>&1;;
  esac
  case "android" in
    $arg1|$arg2)
      curl -s -o /dev/null localhost:8081/index.android.bundle 2>&1;;
  esac
}

# start in background so we get the bundler dashboard
sleep 5 && requestbundles &
backgroundpid=$!
trap 'kill $backgroundpid' EXIT # quit requestBundles on exit
while true; do
  babel-node ./node_modules/react-native/local-cli/cli.js start --resetCache
done
