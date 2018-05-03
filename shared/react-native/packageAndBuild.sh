#!/usr/bin/env bash
# starts up the RN packager & requests both ios and android bundles

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir/..
arg=${1:-}
case $arg in 
  "ios"|"android"|"both"|"")
    ;;
  *)
    echo "Invalid build type. Valid types are 'ios', 'android', or 'both'." >&2
    exit 1;;
esac

requestbundles ()
{
  if [ "$arg" == "" ]; then
    return
  fi
  printf "\nRequesting bundles...\n"
  case $arg in 
    "ios"|"both")
      curl -s -o /dev/null localhost:8081/index.ios.bundle 2>&1;;
  esac
  case $arg in
    "android"|"both")
      curl -s -o /dev/null localhost:8081/index.android.bundle 2>&1
  esac
}

sleep 5 && requestbundles &
./node_modules/react-native/scripts/packager.sh --resetCache
