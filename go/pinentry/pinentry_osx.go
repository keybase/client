// +build darwin

package pinentry

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"

	kc "github.com/keybase/go-osxkeychain"
)

const (
	// pinentryServiceName is the service name that pinentry uses
	// when storing into the Keychain.
	pinentryServiceName = "GnuPG"
	// accountNameByteLength is how many random bytes to use to
	// generate the account name. 32 bytes of randomness is more
	// than enough to make the account name unpredictable.
	accountNameByteLength = 32
)

type pinentrySecretStoreInfo string

func (pi *pinentryInstance) useSecretStore(useSecretStore bool) (pinentrySecretStoreInfo, error) {
	if !useSecretStore {
		return "", nil
	}

	// Make account name unpredictable to make it infeasible for
	// an attacker to guess (and thus sniff the passphrase). See
	// https://github.com/keybase/client/issues/484#issuecomment-114313867
	// .
	var accountNameBytes [accountNameByteLength]byte
	n, err := rand.Read(accountNameBytes[:])
	if n != accountNameByteLength {
		return "", fmt.Errorf("Unexpected random byte count %d", n)
	}
	if err != nil {
		return "", err
	}

	accountName := "keybase-" + hex.EncodeToString(accountNameBytes[:])

	// This will cause a "Save in Keychain" checkbox to appear in
	// the pinentry dialog. If checked, pinentry will then save
	// the entered passphrase into the keychain with the service
	// name "GnuPG" and the account name equal to the passed-in
	// cache-id option value.
	pi.Set("OPTION", "cache-id "+accountName, &err)
	return pinentrySecretStoreInfo(accountName), err
}

func (pi *pinentryInstance) shouldStoreSecret(info pinentrySecretStoreInfo) bool {
	accountName := string(info)
	if accountName == "" {
		return false
	}

	// We just want to know when the user did check the "Save in
	// Keychain" checkbox, so remove whatever pinentry put into
	// the keychain, and infer the state of the checkbox from the
	// error (since there will be no error if an entry was found
	// and deleted).
	//
	// This is a bit of a hack -- this may cause a dialog to pop
	// up saying that the client wants to access the user's
	// keychain. But this will do for now until we write our own
	// pinentry.
	attributes := kc.GenericPasswordAttributes{
		ServiceName: pinentryServiceName,
		AccountName: accountName,
	}
	return (kc.FindAndRemoveGenericPassword(&attributes) == nil)
}
