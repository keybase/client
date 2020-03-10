package storage

import (
	"fmt"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type baseBox struct {
	globals.Contextified
	encryptedDB *encrypteddb.EncryptedDB
}

type SecretUI struct {
}

func (d SecretUI) GetPassphrase(pinentry keybase1.GUIEntryArg, terminal *keybase1.SecretEntryArg) (keybase1.GetPassphraseRes, error) {
	return keybase1.GetPassphraseRes{}, fmt.Errorf("no secret UI available")
}

func newBaseBox(g *globals.Context) *baseBox {
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return GetSecretBoxKey(ctx, g.ExternalG())
	}
	dbFn := func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalChatDb
	}
	return &baseBox{
		Contextified: globals.NewContextified(g),
		encryptedDB:  encrypteddb.New(g.ExternalG(), dbFn, keyFn),
	}
}

func (i *baseBox) readDiskBox(ctx context.Context, key libkb.DbKey, res interface{}) (bool, error) {
	return i.encryptedDB.Get(ctx, key, res)
}

func (i *baseBox) writeDiskBox(ctx context.Context, key libkb.DbKey, data interface{}) error {
	return i.encryptedDB.Put(ctx, key, data)
}

func (i *baseBox) maybeNuke(err Error, key libkb.DbKey) {
	if err != nil && err.ShouldClear() {
		i.G().Log.Debug("nuking %v on err: %v", key, err)
		if err := i.G().LocalChatDb.Delete(key); err != nil {
			i.G().Log.Error("unable to clear box on error! err: %s", err)
		}
	}
}
