#!/bin/bash

KEYBASE_DEBUG=1 keybase service 2>&1 | tee -a service.log >/dev/null &
KEYBASE_TEST_ROOT_CERT_PEM="$(cat /opt/scripts/docker_cert.pem)" KEYBASE_DEBUG=1 kbfsfuse -debug -mdserver mdserver:8125 -bserver bserver:8225 /keybase 2>&1 | tee -a kbfs.log >/dev/null &

tail -f service.log kbfs.log
