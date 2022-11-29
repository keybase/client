// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package ldbutils

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/keybase/client/go/kbfs/ioutil"
	"github.com/keybase/client/go/logger"
	"github.com/pkg/errors"
	"github.com/syndtr/goleveldb/leveldb"
	ldberrors "github.com/syndtr/goleveldb/leveldb/errors"
	"github.com/syndtr/goleveldb/leveldb/filter"
	"github.com/syndtr/goleveldb/leveldb/opt"
	"github.com/syndtr/goleveldb/leveldb/storage"
)

const (
	diskCacheVersionFilename string = "version"
	// Metered specified that this DB should be metered.
	Metered = true
	// Unmetered specified that this DB should not be metered.
	Unmetered = false
)

// DbWriteBufferSizeGetter is an interface that contains a method for
// getting the size of a leveldb write buffer.
type DbWriteBufferSizeGetter interface {
	// DbWriteBufferSize indicates how large the write buffer should
	// be on local levelDbs -- this also controls how big the on-disk
	// tables are before compaction.
	DbWriteBufferSize() int
}

var leveldbOptions = &opt.Options{
	Compression: opt.NoCompression,
	WriteBuffer: 10 * opt.MiB,
	BlockSize:   1 << 16,
	// Default max open file descriptors (ulimit -n) is 256 on OS
	// X, and >=1024 on (most?) Linux machines. So set to a low
	// number since we have multiple leveldb instances.
	OpenFilesCacheCapacity: 10,
}

// LeveldbOptions returns leveldb options.
func LeveldbOptions(sizeGetter DbWriteBufferSizeGetter) *opt.Options {
	o := *leveldbOptions
	if sizeGetter != nil {
		o.WriteBuffer = sizeGetter.DbWriteBufferSize()
	}
	return &o
}

// LevelDb is a libkbfs wrapper for leveldb.DB.
type LevelDb struct {
	*leveldb.DB
	closer io.Closer
}

// Close closes the DB.
func (ldb *LevelDb) Close() (err error) {
	err = ldb.DB.Close()
	// Hide the closer error.
	_ = ldb.closer.Close()
	return err
}

// Get gets data from the DB.
func (ldb *LevelDb) Get(key []byte, ro *opt.ReadOptions) (
	value []byte, err error) {
	defer func() {
		if err != nil {
			err = errors.WithStack(err)
		}
	}()
	return ldb.DB.Get(key, ro)
}

// GetWithMeter gets data from the DB while tracking the hit rate.
func (ldb *LevelDb) GetWithMeter(key []byte, hitMeter, missMeter *CountMeter) (
	value []byte, err error) {
	defer func() {
		if err == nil {
			if hitMeter != nil {
				hitMeter.Mark(1)
			}
		} else if missMeter != nil {
			missMeter.Mark(1)
		}
	}()
	return ldb.Get(key, nil)
}

// Put puts data into the DB.
func (ldb *LevelDb) Put(key, value []byte, wo *opt.WriteOptions) (err error) {
	defer func() {
		if err != nil {
			err = errors.WithStack(err)
		}
	}()
	return ldb.DB.Put(key, value, wo)
}

// PutWithMeter gets data from the DB while tracking the hit rate.
func (ldb *LevelDb) PutWithMeter(key, value []byte, putMeter *CountMeter) (
	err error) {
	defer func() {
		if err == nil && putMeter != nil {
			putMeter.Mark(1)
		}
	}()
	return ldb.Put(key, value, nil)
}

// StatStrings returns newline-split leveldb stats, suitable for JSONification.
func (ldb *LevelDb) StatStrings() ([]string, error) {
	stats, err := ldb.GetProperty("leveldb.stats")
	if err != nil {
		return nil, err
	}
	return strings.Split(stats, "\n"), nil
}

// OpenLevelDbWithOptions opens or recovers a leveldb.DB with a
// passed-in storage.Storage as its underlying storage layer, and with
// the options specified.
func OpenLevelDbWithOptions(stor storage.Storage, options *opt.Options) (
	*LevelDb, error) {
	db, err := leveldb.Open(stor, options)
	if ldberrors.IsCorrupted(err) {
		// There's a possibility that if the leveldb wasn't closed properly
		// last time while it was being written, then the manifest is corrupt.
		// This means leveldb must rebuild its manifest, which takes longer
		// than a simple `Open`.
		// TODO: log here
		db, err = leveldb.Recover(stor, options)
	}
	if err != nil {
		stor.Close()
		return nil, err
	}
	return &LevelDb{db, stor}, nil
}

// OpenLevelDb opens or recovers a leveldb.DB with a passed-in
// storage.Storage as its underlying storage layer.
func OpenLevelDb(
	stor storage.Storage, sizeGetter DbWriteBufferSizeGetter) (
	*LevelDb, error) {
	options := LeveldbOptions(sizeGetter)
	options.Filter = filter.NewBloomFilter(16)
	return OpenLevelDbWithOptions(stor, options)
}

func versionPathFromVersion(dirPath string, version uint64) string {
	return filepath.Join(dirPath, fmt.Sprintf("v%d", version))
}

// GetVersionedPathForDb returns a path for the db that includes a
// version number.
func GetVersionedPathForDb(
	log logger.Logger, dirPath string, dbName string,
	currentDbVersion uint64) (versionedDirPath string, err error) {
	// Read the version file
	versionFilepath := filepath.Join(dirPath, diskCacheVersionFilename)
	versionBytes, err := ioutil.ReadFile(versionFilepath)
	// We expect the file to open successfully or not exist. Anything else is a
	// problem.
	version := currentDbVersion
	switch {
	case ioutil.IsNotExist(err):
		// Do nothing, meaning that we will create the version file below.
		log.CDebugf(
			context.TODO(), "Creating new version file for the %s DB.",
			dbName)
	case err != nil:
		log.CDebugf(
			context.TODO(),
			"An error occurred while reading the %s DB "+
				"version file. Using %d as the version and creating a new "+
				"file to record it.", dbName, version)
		// TODO: when we increase the version of the DB, we'll have to
		// make sure we wipe all previous versions of the DB.
	default:
		// We expect a successfully opened version file to parse a
		// single unsigned integer representing the version. Anything
		// else is a corrupted version file. However, this we can
		// solve by deleting everything in the cache.  TODO:
		// Eventually delete the whole DB if we have an out of date
		// version.
		version, err = strconv.ParseUint(string(versionBytes), 10,
			strconv.IntSize)
		if err == nil && version == currentDbVersion {
			// Success case, no need to write the version file again.
			log.CDebugf(
				context.TODO(),
				"Loaded the %s DB version file successfully."+
					" Version: %d", dbName, version)
			return versionPathFromVersion(dirPath, version), nil
		}
		switch {
		case err != nil:
			log.CDebugf(
				context.TODO(),
				"An error occurred while parsing the %s DB "+
					"version file. Using %d as the version.",
				dbName, currentDbVersion)
			// TODO: when we increase the version of the DB, we'll have
			// to make sure we wipe all previous versions of the DB.
			version = currentDbVersion
		case version < currentDbVersion:
			log.CDebugf(
				context.TODO(),
				"The %s DB version file contained an old "+
					"version: %d. Updating to the new version: %d.",
				dbName, version, currentDbVersion)
			// TODO: when we increase the version of the DB, we'll have
			// to make sure we wipe all previous versions of the DB.
			version = currentDbVersion
		case version > currentDbVersion:
			log.CDebugf(
				context.TODO(),
				"The %s DB version file contained a newer "+
					"version (%d) than this client knows how to read. "+
					"Switching to this client's newest known version: %d.",
				dbName, version, currentDbVersion)
			version = currentDbVersion
		}
	}
	// Ensure the DB directory exists.
	err = os.MkdirAll(dirPath, 0700)
	if err != nil {
		// This does actually need to be fatal.
		return "", err
	}
	versionString := strconv.FormatUint(version, 10)
	err = ioutil.WriteFile(versionFilepath, []byte(versionString), 0600)
	if err != nil {
		// This also needs to be fatal.
		return "", err
	}
	return versionPathFromVersion(dirPath, version), nil
}

// OpenVersionedLevelDb opens a level DB under a versioned path on the
// local filesystem under storageRoot. The path include dbFolderName
// and dbFilename. Note that dbFilename is actually created as a
// folder; it's just where raw LevelDb lives.
func OpenVersionedLevelDb(
	log logger.Logger, storageRoot string, dbFolderName string,
	currentDbVersion uint64, dbFilename string,
	sizeGetter DbWriteBufferSizeGetter) (db *LevelDb, err error) {
	dbPath := filepath.Join(storageRoot, dbFolderName)
	versionPath, err := GetVersionedPathForDb(
		log, dbPath, dbFolderName, currentDbVersion)
	if err != nil {
		return nil, err
	}
	p := filepath.Join(versionPath, dbFilename)
	log.Debug("opening LevelDB: %s", p)
	storage, err := storage.OpenFile(p, false)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			storage.Close()
		}
	}()
	options := LeveldbOptions(sizeGetter)
	if db, err = OpenLevelDbWithOptions(storage, options); err != nil {
		return nil, err
	}
	return db, nil
}
