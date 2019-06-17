package libkb

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/protocol/keybase1"
)

type pwhStoreIdentifier string

const (
	ssEddsaSuffix  pwhStoreIdentifier = "tmp_eddsa"
	ssPwhashSuffix                    = "tmp_pwhash"
)

func formatPPSSecretStoreIdentifier(username NormalizedUsername, typ pwhStoreIdentifier) NormalizedUsername {
	return NormalizedUsername(fmt.Sprintf("%s.%s", username, typ))
}

func RetrieveFullPassphraseStream(mctx MetaContext, username NormalizedUsername, uid keybase1.UID) (ret *PassphraseStream, err error) {
	defer mctx.Trace(fmt.Sprintf("RetrieveFullPassphraseStream(%q,%q)", username, uid),
		func() error { return err })()

	ss := mctx.G().SecretStore()
	fullSecret, err := ss.RetrieveSecret(mctx, username)
	if err != nil {
		mctx.Debug("No secret found for %q", username)
		return nil, err
	}
	lks := NewLKSecWithFullSecret(fullSecret, uid)
	err = lks.LoadServerHalf(mctx)
	if err == nil {
		mctx.Debug("Loaded server half, bailing out")
		return nil, errors.New("user has secret server-half, cannot recover after signup")
	}

	mctx.Debug("No server-half, as expected, err was: %s", err)
	lks.ResetServerHalf()

	pps, err := NewPassphraseStreamLKSecOnly(lks)
	if err != nil {
		return nil, err
	}
	edDSASecret, err := ss.RetrieveSecret(mctx, formatPPSSecretStoreIdentifier(username, ssEddsaSuffix))
	if err != nil {
		return nil, err
	}
	pwHashSecret, err := ss.RetrieveSecret(mctx, formatPPSSecretStoreIdentifier(username, ssPwhashSuffix))
	if err != nil {
		return nil, err
	}
	err = pps.SetEdDSAAndPWH(pwHashSecret.Bytes(), edDSASecret.Bytes())
	if err != nil {
		return nil, err
	}

	return pps, nil
}

func StoreFullPassphraseStream(mctx MetaContext, username NormalizedUsername, pps *PassphraseStream) (err error) {
	defer mctx.Trace(fmt.Sprintf("StoreFullPassphraseStream(%q)", username),
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
			clrErr := ClearFullPassphraseSecret(mctx, username)
			if clrErr != nil {
				mctx.Debug("Failed to clear: %v", clrErr)
			}
		}
	}()

	secret, err = NewLKSecFullSecretFromBytes(pps.EdDSASeed())
	if err != nil {
		return err
	}
	id = formatPPSSecretStoreIdentifier(username, ssEddsaSuffix)
	if err := ss.StoreSecret(mctx, id, secret); err != nil {
		return err
	}

	secret, err = NewLKSecFullSecretFromBytes(pps.PWHash())
	if err != nil {
		return err
	}
	id = formatPPSSecretStoreIdentifier(username, ssPwhashSuffix)
	if err := ss.StoreSecret(mctx, id, secret); err != nil {
		return err
	}

	return nil
}

func ClearFullPassphraseSecret(mctx MetaContext, username NormalizedUsername) error {
	ss := mctx.G().SecretStore()

	prevOptions := ss.GetOptions(mctx)
	ss.SetOptions(mctx, &SecretStoreOptions{RandomPw: true})
	// Restore secret store options after we are done here.
	defer ss.SetOptions(mctx, prevOptions)

	err1 := ss.ClearSecret(mctx, formatPPSSecretStoreIdentifier(username, ssEddsaSuffix))
	err2 := ss.ClearSecret(mctx, formatPPSSecretStoreIdentifier(username, ssPwhashSuffix))
	return CombineErrors(err1, err2)
}
