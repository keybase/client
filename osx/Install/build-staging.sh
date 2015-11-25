#!/bin/sh

set -e # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

sh set-run-mode.sh staging
sh build-app.sh

# Reset default run mode
sh set-run-mode.sh devel
