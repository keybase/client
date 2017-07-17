// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build android

package keybase

import "github.com/keybase/client/go/libkb"

// UnsafeExternalKeyStore - We have to duplicate the interface defined in libkb.UnsafeExternalKeyStore
// Otherwise we get an undefined param error when we use this as an argument
// in an exported func
type UnsafeExternalKeyStore interface {
	RetrieveSecret(serviceName string, key string) ([]byte, error)
	StoreSecret(serviceName string, key string, secret []byte) error
	ClearSecret(serviceName string, key string) error
	GetUsersWithStoredSecretsMsgPack(serviceName string) ([]byte, error)
	SetupKeyStore(serviceName string, key string) error
}

func SetGlobalExternalKeyStore(s UnsafeExternalKeyStore) {
	// TODO: Gross! can we fix this?
	libkb.SetGlobalExternalKeyStore(libkb.UnsafeExternalKeyStore(s))
}
