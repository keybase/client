#!/usr/bin/env bash

export KEYBASE_SERVER_URI=http://$KBWEB_PORT_3000_TCP_ADDR:$KBWEB_PORT_3000_TCP_PORT
/keybase/bin/daemon
