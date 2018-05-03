#!/usr/bin/env bash
# starts up the RN packager & requests both ios and android bundles

requestbundles ()
{
  printf "\nRequesting bundles...\n"
  curl -s -o /dev/null localhost:8081/index.ios.bundle 2>&1 
  curl -s -o /dev/null localhost:8081/index.android.bundle 2>&1
}
# give the packager time to start
sleep 5 && requestbundles &
yarn rn-start 
