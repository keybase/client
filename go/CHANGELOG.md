

## 1.0.19

- Support for Curve25519 GPG keys (via vendored PR: keybase/go-crypto#38)
- Support for Signature Subpacket 33 (via vendored PR: keybase/go-crypto#39)

## 1.0.18
- Some people (like @brentmaxwell) had broken sigchains due to bad
  short signature IDs. Ignore those. (via vendored PR: keybase/go-crypto#36)
- Preliminary ECDH support so that people can import/export these
  keys (though not currently possible to decrypt/encrypt with them)
  (Via vendored PR: keybase/go-crypto#37)
- Fix for keybase/client#4661 and keybase/client#4634 via PR keybase/client#4667
  - The bug was that some people were encrypting their local secret keys with
    the wrong symmetric key, if provisioned by a buggy device. We still need
    to roll out further fixes to unbreak devices broken by this change. PR
    #4667 just ensures that it won't continue to happen.

## 1.0.17
- Allow signatures with DSA keys without needing to specify explicit signing flags
  in the Public key. Also, better tie-breaking if there are two self-signatures
  at the same time; use the one with the valid flags.
   (via vendored PR: keybase/go-crypto#31 and keybase/go-crypto#32 respectively)
- Don't overwrite valid flags with empty flags, and assume lots of power for a
  primary key without flags
   (via vendored PR: keybase/go-crypto#33 and keybase/go-crypto#34, respectively)

## 1.0.16 (2016-05-23)
- Don't publish private warnings to debug log
- Ignore signatures over attributes like pictures in OpenPGP keys
   (via vendored PR: keybase/go-crypto#29)

## 1.0.15 (2016-03-31)
- If a public key really consists of the same key listed twice, then
  merge the two keys and try again (PR: keybase/client#2130).
- Support for sneak's public key (via vendored PR: keybase/go-crypto#17)
- Support for Brainpool elliptic curves in PGP keys (via vendored PR: keybase/go-crypto#18)
- Support for selecting keys from GPG smart cards/YubiKeys (PRs: keybase/go-crypto#22 keybase/client#2440)
- Change login provisioning flow to start with username (PR: keybase/client#2176)
- `keybase log send` works when service isn't running (PR: keybase/client#2336)
- Add `keybase pgp list` command (PR: keybase/client#2338)
- `keybase id` uses Identify2 (PR: keybase/client#2426)
- Identify2 displays revoked proofs (PR: keybase/client#2445)
- Add --skip-proof-cache option to id command (PR: keybase/client#2310)
- Return non-zero status when showing an error (PR: keybase/client#2361)
- Include device ID in non-Tor-mode requests to keybase.io, for logging (PR: keybase/client##2434)
- Fix a bug where `keybase id` printed nothing (PR: keybase/client#2468)

## 1.0.14 (2016-02-24)
- Fix crasher on passphrase recover on Linux (PR: keybase/client#2062)
- Local snooze for broken remote proofs (PR: keybase/client#1934)
- More Gnu S2K Support (commit: 24fc27084690c564464263b9e35936ba9dc40bc1)
- Remove Gopass and Miniline; use patched ssh/terminal (PR: keybase/client#2078)
- Modernize and fix up config get/set (PR: keybase/client#2071)

## 1.0.13 (2016-02-17)
- Fix service not restarting after version mismatch check
- Fix bad sigchain link error (PR: keybase/client#1998)

## 1.0.12 (2016-02-15)
- Fix invalid plist on brew install/upgrade (#2074)

## 1.0.11 (2016-02-10)
- Forward-compatibility fix, for future RPCS (PR: keybase/client#1919)
- Fix potential recursive LogUI Explosion (PR: keybase/client#1925)
- Another crack at GNU S2K Dummy (via vendored PR: keybase/go-crypto#10)
- Performance improvement in sigchain replays (PR keybase/client#1930)
- Logs in devel mode go to ~/Library/Logs/KeybaseDevel on darwin (PR: keybase/client#1926)
- RSA Support for public exponent e's with <= 7 bytes (rather than 3)
  (via vendored PR: keybase/go-crypto#8)
- Don't encrypt for DSA and do encrypt for ElGamal subkeys
  (via vendored PR: keybase/go-crytpo#11)
- Properly serialize ElGamal Subkeys (via vendored PR: keybase/go-crypto#13)
- Allow DSA sub-signing keys without an explicit KeyFlags (via vendored PR: keybase/go-crypto#12)
- Fix handling of revoked subkeys (via PR keybase/client#1966 and vendored PR: keybase/go-crypto#15)

## 1.0.10 (2016-02-05)
- Detached pgp verify was broken for messages shorter than 100 bytes (PR: keybase/client#1862)
- Only restart driver if necessary when upgrading on Windows (PR: keybase/client#1842)
- Fix formatting for certain errors (PR: keybase/client#1830)
- Cache InputCanceled from SecretUI from KBFS crypto ops (PR: keybase/client#1795)
- New `keybase status` command, previous one moved to `keybase dump-keyfamily`
  (PR: keybase/client#1787)
- Fix regression in auto-fork (PR: keybase/client#1831)
- Add ChainLink cache to speed up identify2 (PR: keybase/client#1868)
- Add `keybase log send` command (PR: keybase/client#1846)
- Client sends PATH to service (PR: keybase/client#1907)

## 1.0.9 (2016-01-21)
- Windows updater (PR: keybase/client#1770)
- Fix passphrase confirmation logic (PR: keybase/client#1752)
- Fix `keybase passphrase recover` SecretUI, LoginSession issues (PR: keybase/client#1750)
- Allow `keybase sigs revoke` to work with a prefix, and
  have `keybase sigs list` display Sig IDs that will
  work with `keybase sigs revoke` (PR: keybase/client#1739)
- Fix `pgp gen` export to gpg error if gpg doesn't exist (PR: keybase/client#1735)
- Binary mode for all saltpack commands (PR: keybase/client#1727)
- All config save operations use transactions (PR: keybase/client#1724)
- More robust key-parsing on KeyFamily import. Fixed two ways:
  - Don't error out on bad signatures in the PGP keys themselves
     (vendored PR: keybase/go-crypto#7)
  - Skip keys that don't import properly, rather than killing the whole
     key family import (PR: keybase/client#1766)
- saltpack: better error messages (PR: keybase/client#1777)

## 1.0.8 (2016-01-13)
- Do not use current keybase ID as default when generating PGP keys (PR: keybase/client#1706)
- Rename SaltPack to saltpack (PR: keybase/client#1674)
- Fix hang in auth C/I tests (commit: 0a30c4ca47bd4d7b936f8bccf46afc00b143d5a7)
- Better `keybase exp encrypt`/identification interaction (PR: keybase/client#1577)
- Allow disabling self-encryption in `keybase exp encrypt` (PR: keybase/client#1606)
- `keybase exp decrypt` now properly identifies senders, and allows for interactive
  mode if requested (PRs: keybase/client#1613, keybase/client#1617)
- Implement OpenPGP PolicyURI subpacket (via vendored PR: keybase/go-crypto#3)
- OpenPGP better check for nil signing subkeys
    (via vendored keybase/go-crypto commit de6e298306e9dfba84a8f4f9042ee6c2bb02df85)
- SaltPack: descriptive error message on failed decryption (PR: keybase/client#1625)
- Preserve external log message order (PR: keybase/client#1641)
- SaltPack: implement sign/verify commands (PR: keybase/client#1635)
- SaltPack: implement sign/verify package (PRs: keybase/client#1596, keybase/client#1612, keybase/client#1614)
- SaltPack: implement the sender secretbox (PR: keybase/client#1645)
- Fix merkle tree path mismatch bug (PR: keybase/client#1621)
- encoding: Speed up B62 decoder (PRs: keybase/client#1644, keybase/client#1640)
- Fix help topics to only display when 'help' is the parent command
- SaltPack: explain alternatives for failed encryption, and also
  be smart about decryption using the wrong command on the wrong type
  of stream; suggest alterntives. (PR: keybase/client#1633)
- service: hook Identify2 RPC up to engine (PR: keybase/client#1662)
- openpgp: ignore broken signature packets, since some keys are mangled
  due to misbehaving clients and/or key servers (via vendored PR: keybase/go-crypto#4)
- openpgp: slightly better error messages for bad subkey signatures
   (via vendored commit: 5604f1eaa4e038e23bdbbf5bb364fe167ff03e07)
- openpgp: don't choke on UID revocations (via vendored PR: keybase/go-crypto#5).
- Fix missing SecretUI protocol for passphrase change/recover
- Add UnboxBytes32Any() with support for device and paper keys (PR: keybase/client
#1693)
- Improve login error messages (PR: keybase/client#1652)

## 1.0.7
- Don't mask errors in PromptSeletion (Commit: 060ff319e6b50aad09fd0162e50a3212c4f7516d)
- Periodic polling for new tracking statements (PR: keybase/client#1500)
- Testing command for fake new tracking notifications
  (Commit: 540c01b9017502f95e4723f36a906684ff1f4ce6)
- terminal: dumb down miniline to not allow arrow movement,
  which doesn't work across all terminals, in particular,
  those that don't support ESC-u and ESC-e position saving.
  (Commit: ba3cd333dfcc8180a64219470ef48d7dfba207f9)
- Better device-name error message
  (Commit: c2d35f362915fb6fe8bcf220418424eb1a443594)
- SecretUI only has GetPassphrase now (PR: keybase/client#1493)
- Allow generated PGP private key export to GPG (PR: keybase/client#1524)
- Help detect typos in device add (PR: keybase/client#1529)
- Fix login cancel (PR: keybase/client#1546)

## 1.0.6-1
- Fix verify command (PR: keybase/client#1522)
- Fix coinbase proof instructions (PR: keybase/client#1521)

## 1.0.6
- libkb: Load optimizations; don't load unneeded fields (PR: keybase/client#1473)
- engine: bugfix for user switching (PR: keybase/client#1474)
- Fix goroutine leak in RPC calls (PR: keybase/client#1462)
- Fix buggy "No device found No device found" error message
  - (Commit: 8b96270704ac840ee22837f5c404948206742791)
- Fix PGP command line identify/track, flags (PR: keybase/client#1475)
- Installer tweak: don't prompt to start service on windows (PR: keybase/client#1495)
- Ansi color code support for terminal on Windows (PR: keybase/client#1481)
- EdDSA for OpenPGP support (PR: keybase/client#1519)
- Resolve RPC support (PR: keybase/client#1520)

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
