// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build android

package keybase

import "github.com/keybase/client/go/libkb"

// ExternalKeyStore - We have to duplicate the interface defined in libkb.ExternalKeyStore
// Otherwise we get an undefined param error when we use this as an argument
// in an exported func
type ExternalKeyStore interface {
	RetrieveSecret(username string) ([]byte, error)
	StoreSecret(username string, secret []byte) error
	ClearSecret(username string) error
	GetUsersWithStoredSecretsMsgPack() ([]byte, error)
	SetupKeyStore(username string) error
}

func SetGlobalExternalKeyStore(s ExternalKeyStore) {
	// TODO: Gross! can we fix this?
	libkb.SetGlobalExternalKeyStore(libkb.ExternalKeyStore(s))
}
