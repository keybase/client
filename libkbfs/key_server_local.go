package libkbfs

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/storage"
	"golang.org/x/net/context"
)

// KeyServerLocal puts/gets key server halves in/from a local leveldb instance.
type KeyServerLocal struct {
	config Config
	db     *leveldb.DB // TLFCryptKeyServerHalfID -> TLFCryptKeyServerHalf
}

// Test that KeyServerLocal fully implements the KeyServer interface.
var _ KeyServer = (*KeyServerLocal)(nil)

func newKeyServerLocalWithStorage(config Config, storage storage.Storage) (
	*KeyServerLocal, error) {
	db, err := leveldb.Open(storage, leveldbOptions)
	if err != nil {
		return nil, err
	}
	kops := &KeyServerLocal{config, db}
	return kops, nil
}

// NewKeyServerLocal returns a KeyServerLocal with a leveldb instance at the
// given file.
func NewKeyServerLocal(config Config, dbfile string) (*KeyServerLocal, error) {
	storage, err := storage.OpenFile(dbfile)
	if err != nil {
		return nil, err
	}
	return newKeyServerLocalWithStorage(config, storage)
}

// NewKeyServerMemory returns a KeyServerLocal with an in-memory leveldb
// instance.
func NewKeyServerMemory(config Config) (*KeyServerLocal, error) {
	return newKeyServerLocalWithStorage(config, storage.NewMemStorage())
}

// GetTLFCryptKeyServerHalf implements the KeyOps interface for
// KeyServerLocal.
func (ks *KeyServerLocal) GetTLFCryptKeyServerHalf(ctx context.Context,
	serverHalfID TLFCryptKeyServerHalfID) (TLFCryptKeyServerHalf, error) {
	buf, err := ks.db.Get(serverHalfID.ID.Bytes(), nil)
	if err != nil {
		return TLFCryptKeyServerHalf{}, err
	}

	var serverHalf TLFCryptKeyServerHalf
	err = ks.config.Codec().Decode(buf, &serverHalf)
	if err != nil {
		return TLFCryptKeyServerHalf{}, err
	}

	user, err := ks.config.KBPKI().GetLoggedInUser(ctx)
	if err != nil {
		return TLFCryptKeyServerHalf{}, err
	}
	key, err := ks.config.KBPKI().GetCurrentCryptPublicKey(ctx)
	if err != nil {
		return TLFCryptKeyServerHalf{}, err
	}

	err = ks.config.Crypto().VerifyTLFCryptKeyServerHalfID(
		serverHalfID, user, key.KID, serverHalf)
	if err != nil {
		libkb.G.Log.Warning("error verifying server half ID: %s", err)
		return TLFCryptKeyServerHalf{}, MDServerErrorUnauthorized{}
	}
	return serverHalf, nil
}

// PutTLFCryptKeyServerHalves implements the KeyOps interface for KeyServerLocal.
func (ks *KeyServerLocal) PutTLFCryptKeyServerHalves(ctx context.Context,
	serverKeyHalves map[keybase1.UID]map[keybase1.KID]TLFCryptKeyServerHalf) error {
	// batch up the writes such that they're atomic.
	batch := &leveldb.Batch{}
	crypto := ks.config.Crypto()
	for user, deviceMap := range serverKeyHalves {
		for deviceKID, serverHalf := range deviceMap {
			buf, err := ks.config.Codec().Encode(serverHalf)
			if err != nil {
				return err
			}
			id, err := crypto.GetTLFCryptKeyServerHalfID(user, deviceKID, serverHalf)
			if err != nil {
				return err
			}
			batch.Put(id.ID.Bytes(), buf)
		}
	}
	return ks.db.Write(batch, nil)
}

// Copies a key server but swaps the config.
func (ks *KeyServerLocal) copy(config Config) *KeyServerLocal {
	return &KeyServerLocal{config, ks.db}
}
