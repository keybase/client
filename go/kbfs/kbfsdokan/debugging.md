# How do I get more debugging output

Set the environment variable `KEYBASE_MOUNT_FLAGS` to `3` 
(starting in 2019-03). This will append Dokan driver debugging
output to the KBFS log that gets sent with keybase log send.
Additionally this will make the Dokan mount visible accross
all login sessions on the machine.

Note that setting environment variables won't affect an already
running kbfsdokan process.

# Reboot

For many users this helps.

# Is your Dokan driver current?

Currently (2019-02) version `1.2.1.2000`. Have you rebooted after installing Dokan?

# Change mountpoint

`keybase config set mountdir X:`

Sometimes there is something wrong with K:, does an another drive letter work?

# Is your visual studio 2017 redistributable ok?

This should have be installed by the Dokan installer if missing.

# Check if there are AV programs or filesystem drivers which might interfere

Try disabling them for a test, and report the combination that does not work.

# Manually stopping and starting keybase service

`keybase ctl stop`
`keybase ctl start`


