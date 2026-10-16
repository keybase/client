// The iOS share-source matrix, run in one session by wdio.share.conf.ts (tests/e2e/run-ios-share.sh).
// Every source shares into Keybase from another app and, unless KB_SHARE_NO_SEND=1, sends into the
// smoke user's conversation with themselves.
import './flows/share-photos.test'
import './flows/share-safari.test'
import './flows/share-files.test'
import './flows/share-other.test'
