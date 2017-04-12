package storage

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/crypto/nacl/secretbox"
	"golang.org/x/net/context"
)

type boxedData struct {
	V int
	N [24]byte
	E []byte
}

type baseBox struct {
	libkb.Contextified
}

type SecretUI struct {
}

func (d SecretUI) GetPassphrase(pinentry keybase1.GUIEntryArg, terminal *keybase1.SecretEntryArg) (keybase1.GetPassphraseRes, error) {
	return keybase1.GetPassphraseRes{}, fmt.Errorf("no secret UI available")
}

var DefaultSecretUI = func() libkb.SecretUI { return SecretUI{} }

func newBaseBox(g *libkb.GlobalContext) *baseBox {
	return &baseBox{
		Contextified: libkb.NewContextified(g),
	}
}

func (i *baseBox) readDiskBox(ctx context.Context, key libkb.DbKey, res interface{}) (bool, error) {
	var err error
	b, found, err := i.G().LocalChatDb.GetRaw(key)
	if err != nil {
		i.G().Log.Warning("readDiskBox: GetRaw error: %s", err)
		return false, err
	}
	if !found {
		i.G().Log.Warning("readDiskBox: GetRaw not found: %+v", key)
		return false, nil
	}

	// Decode encrypted box
	var boxed boxedData
	if err := decode(b, &boxed); err != nil {
		return true, err
	}
	if boxed.V > cryptoVersion {
		return true, fmt.Errorf("bad crypto version: %d current: %d", boxed.V,
			cryptoVersion)
	}
	enckey, err := getSecretBoxKey(ctx, i.G(), DefaultSecretUI)
	if err != nil {
		return true, err
	}
	pt, ok := secretbox.Open(nil, boxed.E, &boxed.N, &enckey)
	if !ok {
		return true, fmt.Errorf("failed to decrypt inxbox")
	}
	if err = decode(pt, res); err != nil {
		return true, err
	}

	return true, nil
}

func (i *baseBox) writeDiskBox(ctx context.Context, key libkb.DbKey, data interface{}) error {

	// Encode outbox
	dat, err := encode(data)
	if err != nil {
		i.G().Log.Warning("writeDiskBox: %+v encode error: %s", key, err)
		return err
	}

	// Encrypt outbox
	enckey, err := getSecretBoxKey(ctx, i.G(), DefaultSecretUI)
	if err != nil {
		i.G().Log.Warning("writeDiskBox: %+v getSecretBoxKey error: %s", key, err)
		return err
	}
	var nonce []byte
	nonce, err = libkb.RandBytes(24)
	if err != nil {
		return err
	}
	var fnonce [24]byte
	copy(fnonce[:], nonce)
	sealed := secretbox.Seal(nil, dat, &fnonce, &enckey)
	boxed := boxedBlock{
		V: cryptoVersion,
		E: sealed,
		N: fnonce,
	}

	// Encode encrypted outbox
	if dat, err = encode(boxed); err != nil {
		i.G().Log.Warning("writeDiskBox: %+v encode boxed error: %s", key, err)
		return err
	}

	// Write out
	if err = i.G().LocalChatDb.PutRaw(key, dat); err != nil {
		i.G().Log.Warning("writeDiskBox: %+v put raw error: %s", key, err)
		return err
	}

	return nil
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
