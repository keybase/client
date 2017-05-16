// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"os"
	"path/filepath"
	"sync"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/ioutil"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/storage"
	"golang.org/x/net/context"
)

// KeyServerLocal puts/gets key server halves in/from a local leveldb instance.
type KeyServerLocal struct {
	config Config
	db     *leveldb.DB // TLFCryptKeyServerHalfID -> TLFCryptKeyServerHalf
	log    logger.Logger

	shutdownLock *sync.RWMutex
	shutdown     *bool
	shutdownFunc func(logger.Logger)
}

// Test that KeyServerLocal fully implements the KeyServer interface.
var _ KeyServer = (*KeyServerLocal)(nil)

func newKeyServerLocal(config Config, storage storage.Storage,
	shutdownFunc func(logger.Logger)) (*KeyServerLocal, error) {
	db, err := leveldb.Open(storage, leveldbOptions)
	if err != nil {
		return nil, err
	}
	kops := &KeyServerLocal{config, db, config.MakeLogger(""),
		&sync.RWMutex{}, new(bool), shutdownFunc}
	return kops, nil
}

// NewKeyServerMemory returns a KeyServerLocal with an in-memory leveldb
// instance.
func NewKeyServerMemory(config Config) (*KeyServerLocal, error) {
	return newKeyServerLocal(config, storage.NewMemStorage(), nil)
}

func newKeyServerDisk(
	config Config, dirPath string, shutdownFunc func(logger.Logger)) (
	*KeyServerLocal, error) {
	keyPath := filepath.Join(dirPath, "keys")
	storage, err := storage.OpenFile(keyPath, false)
	if err != nil {
		return nil, err
	}
	return newKeyServerLocal(config, storage, shutdownFunc)
}

// NewKeyServerDir constructs a new KeyServerLocal that stores its
// data in the given directory.
func NewKeyServerDir(config Config, dirPath string) (*KeyServerLocal, error) {
	return newKeyServerDisk(config, dirPath, nil)
}

// NewKeyServerTempDir constructs a new KeyServerLocal that stores its
// data in a temp directory which is cleaned up on shutdown.
func NewKeyServerTempDir(config Config) (*KeyServerLocal, error) {
	tempdir, err := ioutil.TempDir(os.TempDir(), "kbfs_keyserver_tmp")
	if err != nil {
		return nil, err
	}
	return newKeyServerDisk(config, tempdir, func(log logger.Logger) {
		err := ioutil.RemoveAll(tempdir)
		if err != nil {
			log.Warning("error removing %s: %s", tempdir, err)
		}
	})
}

// GetTLFCryptKeyServerHalf implements the KeyServer interface for
// KeyServerLocal.
func (ks *KeyServerLocal) GetTLFCryptKeyServerHalf(ctx context.Context,
	serverHalfID TLFCryptKeyServerHalfID, key kbfscrypto.CryptPublicKey) (
	serverHalf kbfscrypto.TLFCryptKeyServerHalf, err error) {
	if err := checkContext(ctx); err != nil {
		return kbfscrypto.TLFCryptKeyServerHalf{}, err
	}

	ks.shutdownLock.RLock()
	defer ks.shutdownLock.RUnlock()
	if *ks.shutdown {
		err = errors.New("Key server already shut down")
	}

	buf, err := ks.db.Get(serverHalfID.ID.Bytes(), nil)
	if err != nil {
		return
	}

	err = ks.config.Codec().Decode(buf, &serverHalf)
	if err != nil {
		return kbfscrypto.TLFCryptKeyServerHalf{}, err
	}

	session, err := ks.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return kbfscrypto.TLFCryptKeyServerHalf{}, err
	}

	err = ks.config.Crypto().VerifyTLFCryptKeyServerHalfID(
		serverHalfID, session.UID, key, serverHalf)
	if err != nil {
		ks.log.CDebugf(ctx, "error verifying server half ID: %+v", err)
		return kbfscrypto.TLFCryptKeyServerHalf{}, kbfsmd.ServerErrorUnauthorized{
			Err: err}
	}
	return serverHalf, nil
}

// PutTLFCryptKeyServerHalves implements the KeyOps interface for KeyServerLocal.
func (ks *KeyServerLocal) PutTLFCryptKeyServerHalves(ctx context.Context,
	keyServerHalves UserDeviceKeyServerHalves) error {
	if err := checkContext(ctx); err != nil {
		return err
	}

	ks.shutdownLock.RLock()
	defer ks.shutdownLock.RUnlock()
	if *ks.shutdown {
		return errors.New("Key server already shut down")
	}

	// batch up the writes such that they're atomic.
	batch := &leveldb.Batch{}
	crypto := ks.config.Crypto()
	for uid, deviceMap := range keyServerHalves {
		for deviceKey, serverHalf := range deviceMap {
			buf, err := ks.config.Codec().Encode(serverHalf)
			if err != nil {
				return err
			}
			id, err := crypto.GetTLFCryptKeyServerHalfID(uid, deviceKey, serverHalf)
			if err != nil {
				return err
			}
			batch.Put(id.ID.Bytes(), buf)
		}
	}
	return ks.db.Write(batch, nil)
}

// DeleteTLFCryptKeyServerHalf implements the KeyOps interface for
// KeyServerLocal.
func (ks *KeyServerLocal) DeleteTLFCryptKeyServerHalf(ctx context.Context,
	_ keybase1.UID, _ kbfscrypto.CryptPublicKey,
	serverHalfID TLFCryptKeyServerHalfID) error {
	if err := checkContext(ctx); err != nil {
		return err
	}

	ks.shutdownLock.RLock()
	defer ks.shutdownLock.RUnlock()
	if *ks.shutdown {
		return errors.New("Key server already shut down")
	}

	// TODO: verify that the kid is really valid for the given uid

	if err := ks.db.Delete(serverHalfID.ID.Bytes(), nil); err != nil {
		return err
	}
	return nil
}

// Copies a key server but swaps the config.
func (ks *KeyServerLocal) copy(config Config) *KeyServerLocal {
	return &KeyServerLocal{config, ks.db, config.MakeLogger(""),
		ks.shutdownLock, ks.shutdown, ks.shutdownFunc}
}

// Shutdown implements the KeyServer interface for KeyServerLocal.
func (ks *KeyServerLocal) Shutdown() {
	ks.shutdownLock.Lock()
	defer ks.shutdownLock.Unlock()
	if *ks.shutdown {
		return
	}
	*ks.shutdown = true

	if ks.db != nil {
		ks.db.Close()
	}

	if ks.shutdownFunc != nil {
		ks.shutdownFunc(ks.log)
	}
}
