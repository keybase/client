// +build darwin

package pinentry

import (
	kc "github.com/keybase/go-osxkeychain"
)

const (
	pinentryServiceName = "GnuPG"
	pinentryAccountName = "keybase-tmp"
)

func (pi *pinentryInstance) useSecretStore(useSecretStore bool) error {
	if !useSecretStore {
		return nil
	}

	var err error
	// This will cause a "Save in Keychain" checkbox to appear in
	// the pinentry dialog. If checked, pinentry will then save
	// the entered passphrase into the keychain with the service
	// name "GnuPG" and the account name equal to the passed-in
	// cache-id option value.
	pi.Set("OPTION", "cache-id "+pinentryAccountName, &err)
	return err
}

func (pi *pinentryInstance) shouldStoreSecret() bool {
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
		AccountName: pinentryAccountName,
	}
	return (kc.FindAndRemoveGenericPassword(&attributes) == nil)
}
