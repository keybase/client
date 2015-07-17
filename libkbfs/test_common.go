package libkbfs

import (
	"testing"

	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/net/context"
)

// NewRootMetadataForTest returns a new initialized RootMetadata object for testing.
func NewRootMetadataForTest(d *TlfHandle, id TlfID) *RootMetadata {
	rmd := NewRootMetadata(d, id)
	var keyGen KeyGen
	if id.IsPublic() {
		keyGen = PublicKeyGen
	} else {
		keyGen = 1
	}
	rmd.data.Dir = DirEntry{
		BlockInfo: BlockInfo{
			BlockPointer: BlockPointer{
				KeyGen:  keyGen,
				DataVer: 1,
			},
			EncodedSize: 1,
		},
	}
	// make up the MD ID
	rmd.mdID = MdID{id[0]}
	return rmd
}

// MakeTestConfigOrBust creates and returns a config suitable for
// unit-testing with the given list of users.
func MakeTestConfigOrBust(t *testing.T, blockServerRemoteAddr *string, users ...string) *ConfigLocal {
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

	if blockServerRemoteAddr != nil {
		blockServer :=
			NewBlockServerRemote(context.TODO(), config, *blockServerRemoteAddr)
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

// NewFolder returns a new RootMetadataSigned for testing.
func NewFolder(t *testing.T, x byte, revision uint64, share bool, public bool) (
	TlfID, *TlfHandle, *RootMetadataSigned) {
	id := TlfID{0}
	id[0] = x
	if public {
		id[TlfIDLen-1] = PubTlfIDSuffix
	} else {
		id[TlfIDLen-1] = TlfIDSuffix
	}
	h := NewTlfHandle()
	if public {
		h.Readers = []keybase1.UID{keybase1.PublicUID}
	}
	h.Writers = append(h.Writers, keybase1.MakeTestUID(15))
	if share {
		h.Writers = append(h.Writers, keybase1.MakeTestUID(16))
	}

	rmd := NewRootMetadataForTest(h, id)
	rmd.Revision = revision
	rmd.data.LastWriter = h.Writers[0]
	if !public {
		AddNewKeysOrBust(t, rmd, DirKeyBundle{})
	}

	rmds := &RootMetadataSigned{}
	if public || !share {
		rmds.SigInfo = SignatureInfo{
			Version:      SigED25519,
			Signature:    []byte{42},
			VerifyingKey: MakeFakeVerifyingKeyOrBust("fake key"),
		}
	} else {
		rmds.Macs = make(map[keybase1.UID][]byte)
		rmds.Macs[h.Writers[0]] = []byte{42}
		if share {
			rmds.Macs[h.Writers[1]] = []byte{43}
		}
	}
	rmds.MD = *rmd
	return id, h, rmds
}

// AddNewKeysOrBust adds new keys to root metadata and blows up on error.
func AddNewKeysOrBust(t *testing.T, rmd *RootMetadata, dkb DirKeyBundle) {
	if err := rmd.AddNewKeys(dkb); err != nil {
		t.Fatal(err)
	}
}

func testWithCanceledContext(t *testing.T, ctx context.Context,
	ctlChan chan struct{}, fn func(context.Context) error) {
	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		// wait for the RPC, then cancel the context
		<-ctlChan
		cancel()
	}()

	err := fn(ctx)
	if err != context.Canceled {
		t.Fatalf("Function did not return a canceled error: %v", err)
	}
	// let any waiting goroutines complete, which shouldn't hurt anything
	ctlChan <- struct{}{}
}
