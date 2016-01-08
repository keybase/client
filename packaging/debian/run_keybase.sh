#!/bin/bash

KEYBASE_RUN_MODE=prod keybase service &>/dev/null &
KEYBASE_RUN_MODE=prod kbfsfuse -mdserver mdserver.kbfs.keybase.io:443 -bserver bserver.kbfs.keybase.io:443 /keybase &>/dev/null &
KEYBASE_RUN_MODE=prod /opt/keybase/Keybase &>/dev/null &
