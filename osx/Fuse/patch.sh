#!/usr/bin/env bash

# Rename everything osxfuse to kbfuse
# Run multiple times to workaround dir renames (TODO: Fix hack)
./rename.sh || ./rename.sh || ./rename.sh || ./rename.sh
