// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin
// +build go1.10

package pinentry

import keychain "github.com/keybase/go-keychain"

// TODO: Move this function back into pinentry_osx.go and remove
// pinentry_osx_pre_1.10.go once we migrate to go 1.10.x.

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
	if ref == 0 {
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
