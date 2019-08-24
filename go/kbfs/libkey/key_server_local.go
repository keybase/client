// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkey

import (
	"context"
	"os"
	"path/filepath"
	"sync"

	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/ioutil"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/storage"
)

func checkContext(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return errors.WithStack(ctx.Err())
	default:
		return nil
	}
}

// KeyServerConfig is a config object containing the outside helper
// instances needed by KeyServerLocal.
type KeyServerConfig interface {
	Codec() kbfscodec.Codec
	KBPKI() idutil.KBPKI
}

// KeyServerLocal puts/gets key server halves in/from a local leveldb instance.
type KeyServerLocal struct {
	config KeyServerConfig
	db     *leveldb.DB // kbfscrypto.TLFCryptKeyServerHalfID -> TLFCryptKeyServerHalf
	log    logger.Logger

	shutdownLock *sync.RWMutex
	shutdown     *bool
	shutdownFunc func(logger.Logger)
}

// Test that KeyServerLocal fully implements the KeyServer interface.
var _ KeyServer = (*KeyServerLocal)(nil)

func newKeyServerLocal(
	config KeyServerConfig, log logger.Logger, storage storage.Storage,
	shutdownFunc func(logger.Logger)) (*KeyServerLocal, error) {
	db, err := leveldb.Open(storage, nil)
	if err != nil {
		return nil, err
	}
	kops := &KeyServerLocal{
		config, db, log, &sync.RWMutex{}, new(bool), shutdownFunc}
	return kops, nil
}

// NewKeyServerMemory returns a KeyServerLocal with an in-memory leveldb
// instance.
func NewKeyServerMemory(config KeyServerConfig, log logger.Logger) (
	*KeyServerLocal, error) {
	return newKeyServerLocal(config, log, storage.NewMemStorage(), nil)
}

func newKeyServerDisk(
	config KeyServerConfig, log logger.Logger, dirPath string,
	shutdownFunc func(logger.Logger)) (*KeyServerLocal, error) {
	keyPath := filepath.Join(dirPath, "keys")
	storage, err := storage.OpenFile(keyPath, false)
	if err != nil {
		return nil, err
	}
	return newKeyServerLocal(config, log, storage, shutdownFunc)
}

// NewKeyServerDir constructs a new KeyServerLocal that stores its
// data in the given directory.
func NewKeyServerDir(
	config KeyServerConfig, log logger.Logger, dirPath string) (
	*KeyServerLocal, error) {
	return newKeyServerDisk(config, log, dirPath, nil)
}

// NewKeyServerTempDir constructs a new KeyServerLocal that stores its
// data in a temp directory which is cleaned up on shutdown.
func NewKeyServerTempDir(
	config KeyServerConfig, log logger.Logger) (*KeyServerLocal, error) {
	tempdir, err := ioutil.TempDir(os.TempDir(), "kbfs_keyserver_tmp")
	if err != nil {
		return nil, err
	}
	return newKeyServerDisk(config, log, tempdir, func(log logger.Logger) {
		err := ioutil.RemoveAll(tempdir)
		if err != nil {
			log.Warning("error removing %s: %s", tempdir, err)
		}
	})
}

// GetTLFCryptKeyServerHalf implements the KeyServer interface for
// KeyServerLocal.
func (ks *KeyServerLocal) GetTLFCryptKeyServerHalf(
	ctx context.Context, serverHalfID kbfscrypto.TLFCryptKeyServerHalfID,
	key kbfscrypto.CryptPublicKey) (
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

	err = kbfscrypto.VerifyTLFCryptKeyServerHalfID(
		serverHalfID, session.UID, key, serverHalf)
	if err != nil {
		ks.log.CDebugf(ctx, "error verifying server half ID: %+v", err)
		return kbfscrypto.TLFCryptKeyServerHalf{},
			kbfsmd.ServerErrorUnauthorized{Err: err}
	}
	return serverHalf, nil
}

// PutTLFCryptKeyServerHalves implements the KeyServer interface for
// KeyServerLocal.
func (ks *KeyServerLocal) PutTLFCryptKeyServerHalves(ctx context.Context,
	keyServerHalves kbfsmd.UserDeviceKeyServerHalves) error {
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
	for uid, deviceMap := range keyServerHalves {
		for deviceKey, serverHalf := range deviceMap {
			buf, err := ks.config.Codec().Encode(serverHalf)
			if err != nil {
				return err
			}
			id, err := kbfscrypto.MakeTLFCryptKeyServerHalfID(
				uid, deviceKey, serverHalf)
			if err != nil {
				return err
			}
			batch.Put(id.ID.Bytes(), buf)
		}
	}
	return ks.db.Write(batch, nil)
}

// DeleteTLFCryptKeyServerHalf implements the KeyServer interface for
// KeyServerLocal.
func (ks *KeyServerLocal) DeleteTLFCryptKeyServerHalf(ctx context.Context,
	_ keybase1.UID, _ kbfscrypto.CryptPublicKey,
	serverHalfID kbfscrypto.TLFCryptKeyServerHalfID) error {
	if err := checkContext(ctx); err != nil {
		return err
	}

	ks.shutdownLock.RLock()
	defer ks.shutdownLock.RUnlock()
	if *ks.shutdown {
		return errors.New("Key server already shut down")
	}

	// TODO: verify that the kid is really valid for the given uid

	return ks.db.Delete(serverHalfID.ID.Bytes(), nil)
}

// CopyWithConfigAndLogger copies a key server but swaps the config
// and the logger.
func (ks *KeyServerLocal) CopyWithConfigAndLogger(
	config KeyServerConfig, log logger.Logger) *KeyServerLocal {
	return &KeyServerLocal{
		config, ks.db, log, ks.shutdownLock, ks.shutdown, ks.shutdownFunc}
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
