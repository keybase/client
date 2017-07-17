// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package pinentry

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"

	"github.com/keybase/go-keychain"
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
	if err != nil {
		// It's possible that the pinentry being used doesn't support
		// this option.  So just return instead of causing a fatal
		// error.
		pi.parent.log.Debug("| Error setting pinentry cache-id OPTION: %s", err)
		pi.parent.log.Debug("| Not using secret store as a result.")
		return "", nil
	}
	return pinentrySecretStoreInfo(accountName), err
}

func (pi *pinentryInstance) shouldStoreSecret(info pinentrySecretStoreInfo) bool {
	if len(info) == 0 {
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
	query := keychain.NewItem()
	query.SetSecClass(keychain.SecClassGenericPassword)
	query.SetService(pinentryServiceName)
	query.SetAccount(string(info))
	query.SetMatchLimit(keychain.MatchLimitOne)

	// We need to query and delete by item reference because the
	// OSX keychain API only allows us to delete unowned items
	// this way.
	query.SetReturnRef(true)
	ref, err := keychain.QueryItemRef(query)
	if err != nil {
		// Default to false if there was an error.
		return false
	}
	if ref == nil {
		// If not found, return false.
		return false
	}

	defer keychain.Release(ref)

	err = keychain.DeleteItemRef(ref)
	if err != nil {
		// Default to false if there was an error deleting.
		return false
	}

	// Entry was found and deleted.
	return true
}

func HasWindows() bool {
	// We aren't in an ssh connection, so we can probably spawn a window.
	return len(os.Getenv("SSH_CONNECTION")) == 0
}
