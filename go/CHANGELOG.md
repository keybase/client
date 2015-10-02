## 1.0.0-27 (2015-10-02)

- Bugfix: Now the entire runtime directory contains the "RunMode", e.g.
          /run/user/1000/keybase.staging/. Once again, need to `killall
          keybase; killall kbstage` after upgrading on Linux.

- Performance improvement: Private device keys for the current device 
  are cached in memory.  They are removed upon logout.

## 1.0.0-25 (2015-09-25)

- Bugfix: https://github.com/keybase/keybase-issues/issues/1783

- Bugfix: We now add the "RunMode" to the socket and pid file paths, so that
  you can run more than one type of client at once on Linux (e.g. `keybase`
  and `kbstage`). This means that you'll have to run `killall keybase`
  (or reboot your machine!) after upgrading from 1.0.0 on Linux.

## 1.0.0-24 (2015-09-24)

- Initial staging release
