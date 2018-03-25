#!/bin/bash
set -e

echo "Using time: ${TIMESTAMP:=`date "+%s"`}"


: ${PLATFORM:?"Need to set PLATFORM"}
: ${PLATFORM_BUILD_PATH:?"Need to set PLATFORM_BUILD_PATH, this is the path to the apk/app"}
: ${APPETIZE_TOKEN:?"Need to set APPETIZE_TOKEN"}
: ${BUILD_URL:?"Need to set BUILD_URL"}
: ${S3_URL:?"Need to set S3_URL"}


if [ ! -f ~/.aws/config ]; then
  : ${AWS_ACCESS_KEY_ID:?"Need to set AWS_ACCESS_KEY_ID"}
  : ${AWS_SECRET_ACCESS_KEY:?"Need to set AWS_SECRET_ACCESS_KEY"}
fi


if [ "$PLATFORM" = "android" ]
then
  BUILD_NAME="app-$TIMESTAMP.apk"
elif [ "$PLATFORM" = "ios" ]
then
  BUILD_NAME="app-$TIMESTAMP.app"
else
  echo "Platform should be either Android or iOS"
  exit 1
fi

echo "Uploading to: $S3_URL$BUILD_NAME"

JSON_PAYLOAD="{\"token\": \"$APPETIZE_TOKEN\", \"url\": \"$BUILD_URL$BUILD_NAME\", \"platform\": \"$PLATFORM\"}"

if [ -n "$DRY_RUN" ]; 
then

  echo "curl https://api.appetize.io/v1/app/update"
  echo "  -H 'Content-Type: application/json'"
  echo "  -d '$JSON_PAYLOAD'"
  exit 0
fi

aws s3 cp $PLATFORM_BUILD_PATH $S3_URL$BUILD_NAME

echo "APK_URL: $BUILD_URL$BUILD_NAME"
curl https://api.appetize.io/v1/app/update -H 'Content-Type: application/json' -d "$JSON_PAYLOAD"

exit 0

# Example Run Config
# DRY_RUN=1 \
# PLATFORM=android \
# PLATFORM_BUILD_PATH="android/app/build/outputs/apk/app-debug.apk" \
# BUILD_URL="https://s3-us-west-2.amazonaws.com/kb-appbuilds/" \
# S3_URL="s3://kb-appbuilds/"
# ./uploadApp.sh
# remove DRY_RUN to actually run
