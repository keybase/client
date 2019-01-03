package encrypteddb

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"golang.org/x/crypto/nacl/secretbox"
	"golang.org/x/net/context"
)

type DbFn func(g *libkb.GlobalContext) *libkb.JSONLocalDb
type KeyFn func(context.Context) ([32]byte, error)

type boxedData struct {
	V int
	N [24]byte
	E []byte
}

// ***
// If we change this, make sure to update the key derivation reason for all callers of EncryptedDB!
// ***
const cryptoVersion = 1

// Handle to a db that encrypts values using nacl secretbox.
// Does not encrypt keys.
// Not threadsafe.
type EncryptedDB struct {
	libkb.Contextified

	getSecretBoxKey KeyFn
	getDB           DbFn
}

func New(g *libkb.GlobalContext, getDB DbFn, getSecretBoxKey KeyFn) *EncryptedDB {
	return &EncryptedDB{
		Contextified:    libkb.NewContextified(g),
		getDB:           getDB,
		getSecretBoxKey: getSecretBoxKey,
	}
}

func DecodeBox(ctx context.Context, b []byte, getSecretBoxKey KeyFn,
	res interface{}) error {
	// Decode encrypted box
	var boxed boxedData
	if err := libkb.MPackDecode(b, &boxed); err != nil {
		return err
	}
	if boxed.V > cryptoVersion {
		return fmt.Errorf("bad crypto version: %d current: %d", boxed.V,
			cryptoVersion)
	}
	enckey, err := getSecretBoxKey(ctx)
	if err != nil {
		return err
	}
	pt, ok := secretbox.Open(nil, boxed.E, &boxed.N, &enckey)
	if !ok {
		return fmt.Errorf("failed to decrypt item")
	}

	if err = libkb.MPackDecode(pt, res); err != nil {
		return err
	}
	return nil
}

// Get a value
// Decodes into res
// Returns (found, err). Res is valid only if (found && err == nil)
func (i *EncryptedDB) Get(ctx context.Context, key libkb.DbKey, res interface{}) (bool, error) {
	var err error
	db := i.getDB(i.G())
	b, found, err := db.GetRaw(key)
	if err != nil {
		return false, err
	}
	if !found {
		return false, nil
	}
	if err = DecodeBox(ctx, b, i.getSecretBoxKey, res); err != nil {
		return false, err
	}
	return true, nil
}

func EncodeBox(ctx context.Context, data interface{}, getSecretBoxKey KeyFn) ([]byte, error) {
	dat, err := libkb.MPackEncode(data)
	if err != nil {
		return nil, err
	}

	enckey, err := getSecretBoxKey(ctx)
	if err != nil {
		return nil, err
	}
	var nonce []byte
	nonce, err = libkb.RandBytes(24)
	if err != nil {
		return nil, err
	}
	var fnonce [24]byte
	copy(fnonce[:], nonce)
	sealed := secretbox.Seal(nil, dat, &fnonce, &enckey)
	boxed := boxedData{
		V: cryptoVersion,
		E: sealed,
		N: fnonce,
	}

	// Encode encrypted box
	if dat, err = libkb.MPackEncode(boxed); err != nil {
		return nil, err
	}
	return dat, nil
}

func (i *EncryptedDB) Put(ctx context.Context, key libkb.DbKey, data interface{}) error {
	db := i.getDB(i.G())
	dat, err := EncodeBox(ctx, data, i.getSecretBoxKey)
	if err != nil {
		return err
	}
	// Write out
	return db.PutRaw(key, dat)
}

func (i *EncryptedDB) Delete(ctx context.Context, key libkb.DbKey) error {
	db := i.getDB(i.G())
	return db.Delete(key)
}
