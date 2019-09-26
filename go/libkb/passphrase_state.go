// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"time"

	"github.com/keybase/backoff"
	"github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

func randomPassphraseToState(hasRandomPassphrase bool) keybase1.PassphraseState {
	if hasRandomPassphrase {
		return keybase1.PassphraseState_RANDOM
	}
	return keybase1.PassphraseState_KNOWN
}

func LoadPassphraseState(mctx MetaContext) (passphraseState keybase1.PassphraseState, err error) {
	return LoadPassphraseStateWithForceRepoll(mctx, false)
}

// forceRepoll only forces repoll when the state is RANDOM, but not when it is KNOWN.
func LoadPassphraseStateWithForceRepoll(mctx MetaContext, forceRepoll bool) (passphraseState keybase1.PassphraseState, err error) {
	mctx = mctx.WithLogTag("PPSTATE")
	defer mctx.TraceTimed(fmt.Sprintf("LoadPassphraseState(forceRepoll=%t)", forceRepoll), func() error { return err })()

	if !mctx.G().ActiveDevice.Valid() {
		mctx.Debug("LoadPassphraseState: user is not logged in")
		return passphraseState, NewLoginRequiredError("LoadPassphraseState")
	}

	configState := mctx.G().Env.GetConfig().GetPassphraseState()
	if configState != nil {
		mctx.Debug("LoadPassphraseState: state found in config.json: %#v", configState)
		if !forceRepoll || *configState == keybase1.PassphraseState_KNOWN {
			return *configState, nil
		}
	}

	mctx.Debug("LoadPassphraseState: state not found in config.json; checking legacy leveldb")

	legacyState, err := loadPassphraseStateFromLegacy(mctx)
	if err == nil {
		mctx.Debug("LoadPassphraseState: state found in legacy leveldb: %#v", legacyState)
		MaybeSavePassphraseState(mctx, legacyState)
		if !forceRepoll || legacyState == keybase1.PassphraseState_KNOWN {
			return legacyState, nil
		}
	}
	mctx.Debug("LoadPassphraseState: could not find state in legacy leveldb (%s); checking remote", err)

	remoteState, err := LoadPassphraseStateFromRemote(mctx)
	if err == nil {
		MaybeSavePassphraseState(mctx, remoteState)
		return remoteState, nil
	}
	return passphraseState, fmt.Errorf("failed to load passphrase state from any path, including remote: %s", err)
}

func MaybeSavePassphraseState(mctx MetaContext, passphraseState keybase1.PassphraseState) {
	err := mctx.G().Env.GetConfigWriter().SetPassphraseState(passphraseState)
	if err == nil {
		mctx.Debug("Added PassphraseState=%#v to config file", passphraseState)
	} else {
		mctx.Warning("Failed to save passphraseState=%#v to config file: %s", passphraseState, err)
	}
}

func loadPassphraseStateFromLegacy(mctx MetaContext) (passphraseState keybase1.PassphraseState, err error) {
	currentUID := mctx.CurrentUID()
	cacheKey := DbKey{
		Typ: DBLegacyHasRandomPW,
		Key: currentUID.String(),
	}
	var hasRandomPassphrase bool
	found, err := mctx.G().GetKVStore().GetInto(&hasRandomPassphrase, cacheKey)
	if err != nil {
		return passphraseState, err
	}
	if !found {
		return passphraseState, fmt.Errorf("passphrase state not found in leveldb")
	}
	return randomPassphraseToState(hasRandomPassphrase), nil
}

func LoadPassphraseStateFromRemote(mctx MetaContext) (passphraseState keybase1.PassphraseState, err error) {
	var ret struct {
		AppStatusEmbed
		RandomPassphrase bool `json:"random_pw"`
	}
	err = mctx.G().API.GetDecode(mctx, APIArg{
		Endpoint:       "user/has_random_pw",
		SessionType:    APISessionTypeREQUIRED,
		InitialTimeout: 10 * time.Second,
	}, &ret)
	if err != nil {
		return passphraseState, err
	}
	return randomPassphraseToState(ret.RandomPassphrase), nil
}

func CanLogout(mctx MetaContext) (res keybase1.CanLogoutRes) {
	if !mctx.G().ActiveDevice.Valid() {
		mctx.Debug("CanLogout: looks like user is not logged in")
		res.CanLogout = true
		return res
	}

	if mctx.G().ActiveDevice.KeychainMode() == KeychainModeNone {
		mctx.Debug("CanLogout: ok to logout since the key used doesn't user the keychain")
		res.CanLogout = true
		return res
	}

	if err := CheckCurrentUIDDeviceID(mctx); err != nil {
		switch err.(type) {
		case DeviceNotFoundError, UserNotFoundError,
			KeyRevokedError, NoDeviceError, NoUIDError:
			mctx.Debug("CanLogout: allowing logout because of CheckCurrentUIDDeviceID returning: %s", err.Error())
			return keybase1.CanLogoutRes{CanLogout: true}
		default:
			// Unexpected error like network connectivity issue, fall through.
			// Even if we are offline here, we may be able to get cached value
			// `false` from LoadHasRandomPw and be allowed to log out.
			mctx.Debug("CanLogout: CheckCurrentUIDDeviceID returned: %q, falling through", err.Error())
		}
	}

	prefetcher := mctx.G().GetHasRandomPWPrefetcher()
	forceRepoll := prefetcher == nil || !prefetcher.prefetched
	passphraseState, err := LoadPassphraseStateWithForceRepoll(mctx, forceRepoll)

	if err != nil {
		return keybase1.CanLogoutRes{
			CanLogout: false,
			Reason:    fmt.Sprintf("We couldn't ensure that your account has a passphrase: %s", err.Error()),
		}
	}

	if passphraseState == keybase1.PassphraseState_RANDOM {
		return keybase1.CanLogoutRes{
			CanLogout: false,
			Reason:    "You signed up without a password and need to set a password first",
		}
	}

	res.CanLogout = true
	return res
}

// hasRandomPWPrefetcher implements LoginHook and LogoutHook interfaces and is
// used to ensure that we know current user's NOPW status.
type HasRandomPWPrefetcher struct {
	// cancel func for randompw prefetching context, if currently active.
	hasRPWCancelFn context.CancelFunc
	prefetched     bool
}

func (d *HasRandomPWPrefetcher) prefetchHasRandomPW(g *GlobalContext, uid keybase1.UID) {
	ctx, cancel := context.WithCancel(context.Background())
	d.hasRPWCancelFn = cancel
	d.prefetched = false

	mctx := NewMetaContext(ctx, g).WithLogTag("P_HASRPW")
	go func() {
		defer func() { d.hasRPWCancelFn = nil }()
		mctx.Debug("prefetchHasRandomPW: starting prefetch after two seconds")
		select {
		case <-time.After(2 * time.Second):
		case <-ctx.Done():
			mctx.Debug("prefetchHasRandomPW: return before starting: %v", ctx.Err())
			return
		}
		err := backoff.RetryNotifyWithContext(ctx, func() error {
			mctx.Debug("prefetchHasRandomPW: trying for uid=%q", uid)
			if !mctx.CurrentUID().Equal(uid) {
				// Do not return an error, so backoff does not retry.
				mctx.Debug("prefetchHasRandomPW: current uid has changed, aborting")
				return nil
			}

			state, err := LoadPassphraseState(mctx)
			if err != nil {
				mctx.Debug("prefetchHasRandomPW: loading current passphrase state failed: %s", err)
			} else if state == keybase1.PassphraseState_KNOWN {
				// Can't go back to RANDOM
				return nil
			}

			passphraseState, err := LoadPassphraseStateFromRemote(mctx)
			if err != nil {
				mctx.Debug("prefetchHasRandomPW: load from remote failed: %s", err)
				return err
			}

			mctx.Debug("prefetchHasRandomPW: loaded passphraseState=%#v", passphraseState)
			select {
			case <-ctx.Done():
				mctx.Debug("prefetchHasRandomPW: context cancelled before MaybeSavePassphraseState: %s", ctx.Err())
			default:
				mctx.Debug("prefetchHasRandomPW: running MaybeSavePassphraseState")
				MaybeSavePassphraseState(mctx, passphraseState)
			}
			return nil
		}, backoff.NewExponentialBackOff(), nil)
		if err != nil {
			d.prefetched = true
		}
		mctx.Debug("prefetchHasRandomPW: backoff loop returned: err=%v", err)
	}()
}

func (d *HasRandomPWPrefetcher) OnLogin(mctx MetaContext) error {
	g := mctx.G()
	uid := g.GetEnv().GetUID()
	if !uid.IsNil() {
		d.prefetchHasRandomPW(g, uid)
	}
	return nil
}

func (d *HasRandomPWPrefetcher) OnLogout(mctx MetaContext) error {
	if d.hasRPWCancelFn != nil {
		mctx.Debug("Cancelling prefetcher in OnLogout hook (P_HASRPW)")
		d.hasRPWCancelFn()
	}
	return nil
}
