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

var DefaultSecretUI = func() libkb.SecretUI { return SecretUI{} }

func newBaseBox(g *globals.Context) *baseBox {
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return getSecretBoxKey(ctx, g.ExternalG(), DefaultSecretUI)
	}

	return &baseBox{
		Contextified: globals.NewContextified(g),
		encryptedDB:  encrypteddb.New(g.ExternalG(), g.LocalChatDb, keyFn),
	}
}

func (i *baseBox) readDiskBox(ctx context.Context, key libkb.DbKey, res interface{}) (bool, error) {
	return i.encryptedDB.Get(ctx, key, res)
}

func (i *baseBox) writeDiskBox(ctx context.Context, key libkb.DbKey, data interface{}) error {
	return i.encryptedDB.Put(ctx, key, data)
}

func (i *baseBox) maybeNuke(err Error, key libkb.DbKey) Error {
	if err != nil && err.ShouldClear() {
		if err := i.G().LocalChatDb.Delete(key); err != nil {
			i.G().Log.Error("unable to clear box on error! err: %s", err.Error())
		}
	}
	return err
}

func (i *baseBox) maybeNukeFn(ef func() Error, key libkb.DbKey) Error {
	return i.maybeNuke(ef(), key)
}
