package libkbfs

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"sync"

	"github.com/syndtr/goleveldb/leveldb"
)

type blockEntry struct {
	// These fields are only exported for serialization purposes.
	BlockData     []byte
	Refs          map[BlockRefNonce]bool
	KeyServerHalf BlockCryptKeyServerHalf
}

// bserverLocalStorage abstracts the various methods of storing blocks
// for bserverLocal.
type bserverLocalStorage interface {
	get(id BlockID) (blockEntry, error)
	put(id BlockID, entry blockEntry) error
	addReference(id BlockID, refNonce BlockRefNonce) error
	removeReference(id BlockID, refNonce BlockRefNonce) error
}

// bserverMemStorage stores block data in an in-memory map.
type bserverMemStorage struct {
	lock sync.RWMutex
	m    map[BlockID]blockEntry
}

var _ bserverLocalStorage = (*bserverMemStorage)(nil)

func makeBserverMemStorage() *bserverMemStorage {
	return &bserverMemStorage{m: make(map[BlockID]blockEntry)}
}

func (s *bserverMemStorage) get(id BlockID) (blockEntry, error) {
	s.lock.RLock()
	defer s.lock.RUnlock()
	return s.m[id], nil
}

func (s *bserverMemStorage) put(id BlockID, entry blockEntry) error {
	s.lock.Lock()
	defer s.lock.Unlock()
	s.m[id] = entry
	return nil
}

func (s *bserverMemStorage) addReference(id BlockID, refNonce BlockRefNonce) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	entry, ok := s.m[id]
	if !ok {
		return IncrementMissingBlockError{id}
	}

	entry.Refs[refNonce] = true
	s.m[id] = entry
	return nil
}

func (s *bserverMemStorage) removeReference(id BlockID, refNonce BlockRefNonce) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	entry, ok := s.m[id]
	if !ok {
		// This block is already gone; no error.
		return nil
	}

	delete(entry.Refs, refNonce)
	if len(entry.Refs) == 0 {
		delete(s.m, id)
	} else {
		s.m[id] = entry
	}
	return nil
}

// bserverFileStorage stores block data in flat files on disk.
type bserverFileStorage struct {
	codec Codec
	lock  sync.RWMutex
	dir   string
}

var _ bserverLocalStorage = (*bserverFileStorage)(nil)

func makeBserverFileStorage(codec Codec, dir string) *bserverFileStorage {
	return &bserverFileStorage{codec: codec, dir: dir}
}

// Store each block in its own file with name equal to the hex-encoded
// blockID. Splay the filenames over 256^2 subdirectories (one byte
// for the hash type plus the first byte of the hash data) using the
// first four characters of the name to keep the number of directories
// in dir itself to a manageable number, similar to git.
func (s *bserverFileStorage) buildPath(id BlockID) string {
	idStr := id.String()
	return filepath.Join(s.dir, idStr[:4], idStr[4:])
}

func (s *bserverFileStorage) getLocked(p string) (blockEntry, error) {
	buf, err := ioutil.ReadFile(p)
	if err != nil {
		return blockEntry{}, err
	}

	var entry blockEntry
	err = s.codec.Decode(buf, &entry)
	if err != nil {
		return blockEntry{}, err
	}

	return entry, nil
}

func (s *bserverFileStorage) get(id BlockID) (blockEntry, error) {
	s.lock.RLock()
	defer s.lock.RUnlock()
	return s.getLocked(s.buildPath(id))
}

func (s *bserverFileStorage) putLocked(p string, entry blockEntry) error {
	entryBuf, err := s.codec.Encode(entry)
	if err != nil {
		return err
	}

	err = os.MkdirAll(filepath.Dir(p), 0700)
	if err != nil {
		return err
	}

	return ioutil.WriteFile(p, entryBuf, 0600)
}

func (s *bserverFileStorage) put(id BlockID, entry blockEntry) error {
	s.lock.Lock()
	defer s.lock.Unlock()
	return s.putLocked(s.buildPath(id), entry)
}

func (s *bserverFileStorage) addReference(id BlockID, refNonce BlockRefNonce) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	p := s.buildPath(id)
	entry, err := s.getLocked(p)
	if err != nil {
		if err == leveldb.ErrNotFound {
			return IncrementMissingBlockError{id}
		}
		return err
	}

	entry.Refs[refNonce] = true
	return s.putLocked(p, entry)
}

func (s *bserverFileStorage) removeReference(id BlockID, refNonce BlockRefNonce) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	p := s.buildPath(id)
	entry, err := s.getLocked(p)
	if err != nil {
		if err == leveldb.ErrNotFound {
			// This block is already gone; no error.
			return nil
		}
		return err
	}

	delete(entry.Refs, refNonce)
	if len(entry.Refs) == 0 {
		return os.Remove(p)
	}
	return s.putLocked(p, entry)
}

// bserverLeveldbStorage stores block data in a LevelDB database. This
// is kept around only for benchmarking purposes.
type bserverLeveldbStorage struct {
	codec Codec
	lock  sync.RWMutex
	db    *leveldb.DB
}

var _ bserverLocalStorage = (*bserverLeveldbStorage)(nil)

func makeBserverLeveldbStorage(codec Codec, db *leveldb.DB) *bserverLeveldbStorage {
	return &bserverLeveldbStorage{codec: codec, db: db}
}

func (s *bserverLeveldbStorage) getLocked(id BlockID) (blockEntry, error) {
	buf, err := s.db.Get(id.Bytes(), nil)
	if err != nil {
		return blockEntry{}, err
	}

	var entry blockEntry
	err = s.codec.Decode(buf, &entry)
	if err != nil {
		return blockEntry{}, err
	}

	return entry, nil
}

func (s *bserverLeveldbStorage) get(id BlockID) (blockEntry, error) {
	s.lock.RLock()
	defer s.lock.RUnlock()
	return s.getLocked(id)
}

func (s *bserverLeveldbStorage) putLocked(id BlockID, entry blockEntry) error {
	entryBuf, err := s.codec.Encode(entry)
	if err != nil {
		return err
	}

	return s.db.Put(id.Bytes(), entryBuf, nil)
}

func (s *bserverLeveldbStorage) put(id BlockID, entry blockEntry) error {
	s.lock.Lock()
	defer s.lock.Unlock()
	return s.putLocked(id, entry)
}

func (s *bserverLeveldbStorage) addReference(id BlockID, refNonce BlockRefNonce) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	entry, err := s.getLocked(id)
	if err != nil {
		if err == leveldb.ErrNotFound {
			return IncrementMissingBlockError{id}
		}
		return err
	}

	entry.Refs[refNonce] = true
	return s.putLocked(id, entry)
}

func (s *bserverLeveldbStorage) removeReference(id BlockID, refNonce BlockRefNonce) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	entry, err := s.getLocked(id)
	if err != nil {
		if err == leveldb.ErrNotFound {
			// This block is already gone; no error.
			return nil
		}
		return err
	}

	delete(entry.Refs, refNonce)
	if len(entry.Refs) == 0 {
		return s.db.Delete(id.Bytes(), nil)
	}
	return s.putLocked(id, entry)
}
