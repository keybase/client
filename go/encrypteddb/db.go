package encrypteddb

import (
	"context"
	"fmt"

	"github.com/go-errors/errors"

	"github.com/keybase/client/go/libkb"
	"golang.org/x/crypto/nacl/secretbox"
)

type (
	DbFn  func(g *libkb.GlobalContext) *libkb.JSONLocalDb
	KeyFn func(context.Context) ([32]byte, error)
)

type boxedData struct {
	V int
	N [24]byte
	E []byte
}

// ErrDecryptionFailed is returned when an encrypteddb box fails to decrypt
var ErrDecryptionFailed = errors.New("failed to decrypt item")

// ErrUndecodable wraps msgpack decode failures of a stored box or of its
// decrypted payload. Like ErrDecryptionFailed it means the stored bytes are
// unusable, as opposed to a failure to fetch the key.
var ErrUndecodable = errors.New("failed to decode item")

// ErrUnsupportedVersion wraps a box written with a newer crypto version than
// this client can open.
var ErrUnsupportedVersion = errors.New("unsupported crypto version")

// IsUnusableData reports whether a DecodeBox/Get error means the stored item
// itself can never be read by this client (as opposed to, say, a failure to
// fetch the key). Callers backed by a rebuildable cache delete such items.
func IsUnusableData(err error) bool {
	return errors.Is(err, ErrDecryptionFailed) || errors.Is(err, ErrUndecodable) ||
		errors.Is(err, ErrUnsupportedVersion)
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
	res any,
) error {
	// Decode encrypted box
	var boxed boxedData
	if err := libkb.MPackDecode(b, &boxed); err != nil {
		return fmt.Errorf("%w: box: %w", ErrUndecodable, err)
	}
	if boxed.V > cryptoVersion {
		return fmt.Errorf("%w: %d current: %d", ErrUnsupportedVersion, boxed.V,
			cryptoVersion)
	}
	enckey, err := getSecretBoxKey(ctx)
	if err != nil {
		return err
	}
	pt, ok := secretbox.Open(nil, boxed.E, &boxed.N, &enckey)
	if !ok {
		return ErrDecryptionFailed
	}

	if err = libkb.MPackDecode(pt, res); err != nil {
		return fmt.Errorf("%w: payload: %w", ErrUndecodable, err)
	}
	return nil
}

// Get a value
// Decodes into res
// Returns (found, err). Res is valid only if (found && err == nil)
func (i *EncryptedDB) Get(ctx context.Context, key libkb.DbKey, res any) (bool, error) {
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

func EncodeBox(ctx context.Context, data any, getSecretBoxKey KeyFn) ([]byte, error) {
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

func (i *EncryptedDB) Put(ctx context.Context, key libkb.DbKey, data any) error {
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
