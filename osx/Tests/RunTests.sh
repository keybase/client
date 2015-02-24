#!/bin/sh

# If we aren't running from the command line, then exit
if [ "$GRUNIT_CLI" = "" ] && [ "$GRUNIT_AUTORUN" = "" ]; then
  exit 0
fi

TEST_TARGET_EXECUTABLE_PATH="$TARGET_BUILD_DIR/$EXECUTABLE_FOLDER_PATH"

if [ ! -e "$TEST_TARGET_EXECUTABLE_PATH" ]; then
  echo ""
  echo "  ------------------------------------------------------------------------"
  echo "  Missing executable path: "
  echo "     $TEST_TARGET_EXECUTABLE_PATH."
  echo "  The product may have failed to build."
  echo "  ------------------------------------------------------------------------"
  echo ""
  exit 1
fi

RUN_CMD="ios-sim launch \"$TEST_TARGET_EXECUTABLE_PATH\""

echo "Running: $RUN_CMD"
set +o errexit # Disable exiting on error so script continues if tests fail
eval $RUN_CMD
RETVAL=$?
set -o errexit

exit $RETVAL
