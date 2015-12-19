# spotty

This is a port of [keybase/node-spotty](https://github.com/keybase/node-spotty),
a mechanism to read the current TTY that should work on both Linux and OSX.

## THIS MODULE CANNOT BE TESTED!

Or at least, not with Go's test framework, because Go test
[closes /dev/tty](https://groups.google.com/forum/#!topic/golang-nuts/w6TTJpw9stA).
