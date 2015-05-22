package main

import "github.com/keybase/kbfs/libkbfs"

// Given the list of users, create and return a config suitable for
// unit-testing.
func makeTestConfig(users ...string) *libkbfs.ConfigLocal {
	config := libkbfs.NewConfigLocal()

	localUsers := libkbfs.MakeLocalUsers(users)
	loggedInUser := localUsers[0]

	kbpki := libkbfs.NewKBPKILocal(loggedInUser.Uid, localUsers)

	// TODO: Consider using fake BlockOps and MDOps instead.
	config.SetKBPKI(kbpki)

	signingKey := libkbfs.MakeLocalUserSigningKeyOrBust(loggedInUser.Name)
	crypto := libkbfs.NewCryptoLocal(config.Codec(), signingKey)
	config.SetCrypto(crypto)

	config.SetBlockServer(libkbfs.NewFakeBlockServer())
	config.SetMDServer(libkbfs.NewFakeMDServer(config))

	return config
}
