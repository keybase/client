// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
)

func randomPassphraseToState(hasRandomPassphrase bool) keybase1.PassphraseState {
	if hasRandomPassphrase {
		return keybase1.PassphraseState_RANDOM
	}
	return keybase1.PassphraseState_KNOWN
}

func LoadPassphraseState(mctx MetaContext) (passphraseState keybase1.PassphraseState, err error) {
	return LoadPassphraseStateWithForceRepoll(mctx)
}

// forceRepoll only forces repoll when the state is RANDOM, but not when it is KNOWN.
func LoadPassphraseStateWithForceRepoll(mctx MetaContext) (passphraseState keybase1.PassphraseState, err error) {
	mctx = mctx.WithLogTag("PPSTATE")
	defer mctx.Trace(fmt.Sprintf("LoadPassphraseState()"), &err)()

	// If we're in standalone mode, we don't get the gregor msg about
	// passphrase_state changes. So, force a repoll to the server if the state
	// isn't currently KNOWN.
	forceRepoll := mctx.G().GregorListener == nil

	if len(mctx.G().Env.GetUsername().String()) == 0 {
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
