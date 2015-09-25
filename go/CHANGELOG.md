## 1.0.1 (2015-09-25)

- We no longer cache the gpg path in the service -- because someone might
  install gpg after starting the service, and we were caching the failure
  to find it.

- We now add the "RunMode" to the socket and pid file paths, so that you
  can run more than one type of client at once on Linux (e.g. `keybase`
  and `kbstage`).  This means that you'll have to run `killall keybase`
  (or reboot your machine!) after upgrading from 1.0.0 on Linux.

## 1.0.0 (2015-09-24)

- Initial staging release
