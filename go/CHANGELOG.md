## 1.0.5-0 (2015-12-01)

- Fix bug where cancelled RPC calls would cause hangs (PR: keybase/client#1433)
- Add experimental encrypt/decrypt commands (PR: keybase/client#1429)

## 1.0.4-0 (2015-11-30)

- Save exported GPG key to local encrypted keyring (PR: keybase/client#1419)
- Fix ugly warnings when eldest key not PGP key (PR: keybase/client#1422)
- Further bugfixes for S2K Dummy mode (PR: keybase/client#1420)
- Better handling of shell out to GPG during provisioning (PR: keybase/client#1405)
- Avoid half-provisioned state by doing provisioning work in a transaction-like pattern
   (PR: keybase/client#1406)
- Allow `keybase prove web` to work as in online documentation (PR: keybase/client#1418)
- Workaround for login after sigchain reset (Commmit: 4088eb8c61b856da7dfadf9631bed19270644a80)

## 1.0.3-0 (2015-11-24)

- Fix no device ID during gpg/pgp provisioning (PR: keybase/client#1400)
- Add Support for GNU S2K Dummy mode (PR: keybase/client#1397)

## 1.0.2-0 (2015-11-24)

- Emergency fix for coinbase proofs
   (Commit: 1e2539e58f3666f4fc357ca9c7192212b4b23999)
- Fix keybase-issues#1878, spurious key ownership error.
   (Commit: f1b6e135fdf3741ce823148e9e3f395f485cf734)

## 1.0.1-0 (2015-11-23)

- Allow provision via GPG command line tool so secret key does not need to be imported.
  (PR keybase/client#1359)
- Improve error message for no synced PGP key
  (Bug keybase/keybase-issues#1854)
- Fix username bug during passphrase provision
  (Bug keybase/keybase-issues#1855)
- Auto-restart the service if the client is newer
  (PR keybase/client#1336)
- Rename `keybase reset` to `keybase deprovision`, make it more interactive,
  and have it delete all of your local account data, including keys.
  (PR keybase/client#1330)

## 1.0.0-47 (2015-11-12)

- Brew auto install

## 1.0.0-46 (2015-11-10)

- Clarified GPG provisioning prompts.

## 1.0.0-45 (2015-11-06)

- Added `--tor-mode` and related flags.
- Made tricky commands less prominent in help.

## 1.0.0-44 (2015-11-06)

- Fix passphrase change
- Fix 'pgp gen' documentation

## 1.0.0-43 (2015-11-03)

- Rerelease for homebrew hashes

## 1.0.0-42 (2015-11-03)

- Default to device provisioning via kex2
- Provision via paper key no longer requires username or
  passphrase

## 1.0.0-41 (2015-10-28)

- Added QR code display to terminal when provisioner is a mobile device.
- Fixed confusing passphrase pinentry during device
  provisioning.
- Connection log cleanup.
- Fixed GPG device provisioning.

## 1.0.0-40 (2015-10-27)

- Support for kex2 device provisioning.

## 1.0.0-29 (2015-10-06)

- Bugfix: If no /dev/tty, still provide SecretEntry via UI.
- Bugfix: Update session mtime when saving session file.

## 1.0.0-28 (2015-10-06)

- Performance improvement: Users plus device keys cached for kbfs.

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
