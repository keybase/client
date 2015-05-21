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

// configAsUser clones a test configuration, setting another user as
// the logged in user
func configAsUser(config *libkbfs.ConfigLocal, loggedInUser string) *libkbfs.ConfigLocal {
	c := libkbfs.NewConfigLocal()

	pki := config.KBPKI().(*libkbfs.KBPKILocal)
	loggedInUID, ok := pki.Asserts[loggedInUser]
	if !ok {
		panic("bad test: unknown user: " + loggedInUser)
	}

	var localUsers []libkbfs.LocalUser
	for _, u := range pki.Users {
		localUsers = append(localUsers, u)
	}
	newPKI := libkbfs.NewKBPKILocal(loggedInUID, localUsers)
	c.SetKBPKI(newPKI)

	signingKey := libkbfs.MakeLocalUserSigningKeyOrBust(loggedInUser)
	crypto := libkbfs.NewCryptoLocal(config.Codec(), signingKey)
	c.SetCrypto(crypto)

	c.SetBlockServer(config.BlockServer())
	c.SetMDServer(config.MDServer())

	return c
}
