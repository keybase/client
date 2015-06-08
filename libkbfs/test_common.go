package libkbfs

import (
	bserver "github.com/keybase/kbfs/bserver"
	"testing"
)

// Return a new initialized RootMetadata object for testing.
func newRootMetadataForTest(d *DirHandle, id DirID) *RootMetadata {
	rmd := NewRootMetadata(d, id)
	// TODO: Set this to 0 for public directories.
	rmd.data.Dir.KeyGen = 1
	rmd.data.Dir.DataVer = 1
	// make up the MD ID
	rmd.mdID = MdID{id[0]}
	return rmd
}

// MakeTestConfigOrBust creates and returns a config suitable for
// unit-testing with the given list of users.
func MakeTestConfigOrBust(t *testing.T, blockServerRemote bool, users ...string) *ConfigLocal {
	config := NewConfigLocal()

	localUsers := MakeLocalUsers(users)
	loggedInUser := localUsers[0]

	kbpki := NewKBPKILocal(loggedInUser.UID, localUsers)

	// TODO: Consider using fake BlockOps and MDOps instead.
	config.SetKBPKI(kbpki)

	signingKey := MakeLocalUserSigningKeyOrBust(loggedInUser.Name)
	cryptPrivateKey := MakeLocalUserCryptPrivateKeyOrBust(loggedInUser.Name)
	crypto := NewCryptoLocal(config.Codec(), signingKey, cryptPrivateKey)
	config.SetCrypto(crypto)

	if blockServerRemote {
		blockServer := NewBlockServerRemote(config, bserver.Config.BServerAddr)
		config.SetBlockServer(blockServer)
	} else {
		blockServer, err := NewBlockServerMemory(config)
		if err != nil {
			t.Fatal(err)
		}
		config.SetBlockServer(blockServer)
	}

	mdServer, err := NewMDServerMemory(config)
	if err != nil {
		t.Fatal(err)
	}
	config.SetMDServer(mdServer)

	keyOps, err := NewKeyServerMemory(config.Codec())
	if err != nil {
		t.Fatal(err)
	}
	config.SetKeyOps(keyOps)

	return config
}

// ConfigAsUser clones a test configuration, setting another user as
// the logged in user
func ConfigAsUser(config *ConfigLocal, loggedInUser string) *ConfigLocal {
	c := NewConfigLocal()

	pki := config.KBPKI().(*KBPKILocal)
	loggedInUID, ok := pki.Asserts[loggedInUser]
	if !ok {
		panic("bad test: unknown user: " + loggedInUser)
	}

	var localUsers []LocalUser
	for _, u := range pki.Users {
		localUsers = append(localUsers, u)
	}
	newPKI := NewKBPKILocal(loggedInUID, localUsers)
	c.SetKBPKI(newPKI)

	signingKey := MakeLocalUserSigningKeyOrBust(loggedInUser)
	cryptPrivateKey := MakeLocalUserCryptPrivateKeyOrBust(loggedInUser)
	crypto := NewCryptoLocal(config.Codec(), signingKey, cryptPrivateKey)
	c.SetCrypto(crypto)

	c.SetBlockServer(config.BlockServer())
	c.SetMDServer(config.MDServer())

	c.SetKeyOps(config.KeyOps())

	return c
}
