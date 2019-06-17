package libkb

import (
	"fmt"
	"strings"

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

func isPPSSecretStore(identifier string) bool {
	return strings.HasSuffix(identifier, string(ssEddsaSuffix)) ||
		strings.HasSuffix(identifier, string(ssPwhashSuffix))
}

func RetrieveFullPassphraseStream(mctx MetaContext, username NormalizedUsername, uid keybase1.UID) (ret *PassphraseStream, err error) {
	defer mctx.Trace(fmt.Sprintf("RetrieveFullPassphraseStream(%q,%q)", username, uid),
		func() error { return err })()

	ss := mctx.G().SecretStore()

	edDSASecret, err := ss.RetrieveSecret(mctx, formatPPSSecretStoreIdentifier(username, ssEddsaSuffix))
	if err != nil {
		return nil, err
	}
	pwHashSecret, err := ss.RetrieveSecret(mctx, formatPPSSecretStoreIdentifier(username, ssPwhashSuffix))
	if err != nil {
		return nil, err
	}

	pps, err := newPassphraseStreamPE(pwHashSecret.Bytes(), edDSASecret.Bytes())
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
