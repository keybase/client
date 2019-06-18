// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

// Code in this file drives a temporary storage for PWHash and EdDSA parts of
// passphrase stream. If signup is done with GenerateRandomPassphrase=true and
// it fails, but after SignupJoin has already succeeded (so account has been
// created, but it has no sigchain or devices), we store PWHash and EdDSA parts
// of passphrase stream using additional two secret store entries. Each part is
// 32-bytes so they fit using existing secret store code: we pretend these are
// LKSecFullSecret.

// This partial passphrase stream is then used during login to let the user in
// and continue signup process and provision their first device. Normally they
// would be able to do that by entering their password, but since it was a
// GenerateRandomPassphrase (or NOPW) signup, they don't know it. Both EdDSA
// and PWHash entries are then cleared after provisioning succeeds.

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/protocol/keybase1"
)

// pwhStoreIdentifier is the suffix used for secret store identifier.
type pwhStoreIdentifier string

const (
	ssEddsaSuffix  pwhStoreIdentifier = "tmp_eddsa"
	ssPwhashSuffix pwhStoreIdentifier = "tmp_pwhash"
)

func formatPPSSecretStoreIdentifier(username NormalizedUsername, typ pwhStoreIdentifier) NormalizedUsername {
	return NormalizedUsername(fmt.Sprintf("%s.%s", username, typ))
}

func isPPSSecretStore(identifier string) bool {
	return strings.HasSuffix(identifier, string(ssEddsaSuffix)) ||
		strings.HasSuffix(identifier, string(ssPwhashSuffix))
}

func RetrievePwhashEddsaPassphraseStream(mctx MetaContext, username NormalizedUsername, uid keybase1.UID) (ret *PassphraseStream, err error) {
	defer mctx.Trace(fmt.Sprintf("RetrievePwhashEddsaPassphraseStream(%q,%q)", username, uid),
		func() error { return err })()

	ss := mctx.G().SecretStore()

	var pwHash passphraseStreamPWHash
	pwHashSecret, err := ss.RetrieveSecret(mctx, formatPPSSecretStoreIdentifier(username, ssPwhashSuffix))
	if err != nil {
		return nil, err
	}
	copy(pwHash[:], pwHashSecret.Bytes())

	var eddsaSeed passphraseSteramEdDSASeed
	edDSASecret, err := ss.RetrieveSecret(mctx, formatPPSSecretStoreIdentifier(username, ssEddsaSuffix))
	if err != nil {
		return nil, err
	}
	copy(eddsaSeed[:], edDSASecret.Bytes())

	pps := newPassphraseStreamFromPwhAndEddsa(pwHash, eddsaSeed)
	return pps, nil
}

func StorePwhashEddsaPassphraseStream(mctx MetaContext, username NormalizedUsername, pps *PassphraseStream) (err error) {
	defer mctx.Trace(fmt.Sprintf("StorePwhashEddsaPassphraseStream(%q)", username),
		func() error { return err })()

	ss := mctx.G().SecretStore()

	var secret LKSecFullSecret
	var id NormalizedUsername

	prevOptions := ss.GetOptions(mctx)
	ss.SetOptions(mctx, &SecretStoreOptions{RandomPw: true})
	// Restore secret store options after we are done here.
	defer ss.SetOptions(mctx, prevOptions)

	defer func() {
		if err != nil {
			// Never store partial secret.
			mctx.Debug("Clearing partial secret after unsuccessful store, error was: %s", err)
			clrErr := ClearPwhashEddsaPassphraseStream(mctx, username)
			if clrErr != nil {
				mctx.Debug("Failed to clear: %v", clrErr)
			}
		}
	}()

	secret, err = newLKSecFullSecretFromBytes(pps.EdDSASeed())
	if err != nil {
		return err
	}
	id = formatPPSSecretStoreIdentifier(username, ssEddsaSuffix)
	if err := ss.StoreSecret(mctx, id, secret); err != nil {
		return err
	}

	secret, err = newLKSecFullSecretFromBytes(pps.PWHash())
	if err != nil {
		return err
	}
	id = formatPPSSecretStoreIdentifier(username, ssPwhashSuffix)
	if err := ss.StoreSecret(mctx, id, secret); err != nil {
		return err
	}

	return nil
}

func ClearPwhashEddsaPassphraseStream(mctx MetaContext, username NormalizedUsername) error {
	ss := mctx.G().SecretStore()

	prevOptions := ss.GetOptions(mctx)
	ss.SetOptions(mctx, &SecretStoreOptions{RandomPw: true})
	// Restore secret store options after we are done here.
	defer ss.SetOptions(mctx, prevOptions)

	err1 := ss.ClearSecret(mctx, formatPPSSecretStoreIdentifier(username, ssEddsaSuffix))
	err2 := ss.ClearSecret(mctx, formatPPSSecretStoreIdentifier(username, ssPwhashSuffix))
	return CombineErrors(err1, err2)
}
