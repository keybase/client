// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build android

package keybase

// import "github.com/keybase/client/go/libkb"

// ExternalKeyStore - We have to duplicate the interface defined in libkb.ExternalKeyStore
// Otherwise we get an undefined param error when we use this as an argument
// in an exported func

type ExternalKeyStore interface {
	RetrieveSecret(serviceName string, key string) (LKSecFullSecret, error)
	StoreSecret(serviceName string, key string, secret LKSecFullSecret) error
	ClearSecret(serviceName string, key string) error
	GetUsersWithStoredSecretsMsgPack(serviceName string) ([]byte, error)
	SetupKeyStore(serviceName string, key string) error
}

func SetGlobalExternalKeyStore(s ExternalKeyStore) {
	// TODO: Gross! can we fix this?
	//
	// Commented out by MNK on 10/19/2016 -- I don't know how to get
	// Android to start compiling without a fair amount of work here,
	// so let's comment it out for now.
	//
	// libkb.SetGlobalExternalKeyStore(libkb.ExternalKeyStore(s))
}
