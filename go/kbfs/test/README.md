## KBFS Test

This directory houses the test harness required to execute the KBFS
test language as well as the individual tests.

Libkbfs tests: ```go test```

Fuse tests (linux, os x): ```go test -tags fuse```

Dokan tests (windows): ```go test -tags dokan```
