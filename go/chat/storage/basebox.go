package storage

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"golang.org/x/crypto/nacl/secretbox"
)

type boxedData struct {
	V int
	N [24]byte
	E []byte
}

type baseBox struct {
	libkb.Contextified

	getSecretUI func() libkb.SecretUI
}

func newBaseBox(g *libkb.GlobalContext, getSecretUI func() libkb.SecretUI) *baseBox {
	return &baseBox{
		Contextified: libkb.NewContextified(g),
		getSecretUI:  getSecretUI,
	}
}

func (i *baseBox) readDiskBox(key libkb.DbKey, res interface{}) (bool, error) {
	var err error
	b, found, err := i.G().LocalChatDb.GetRaw(key)
	if err != nil {
		return false, err
	}
	if !found {
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
	enckey, err := getSecretBoxKey(i.G(), i.getSecretUI)
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

func (i *baseBox) writeDiskBox(key libkb.DbKey, data interface{}) error {

	// Encode outbox
	dat, err := encode(data)
	if err != nil {
		return err
	}

	// Encrypt outbox
	enckey, err := getSecretBoxKey(i.G(), i.getSecretUI)
	if err != nil {
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
		return err
	}

	// Write out
	if err = i.G().LocalChatDb.PutRaw(key, dat); err != nil {
		return err
	}

	return nil
}
