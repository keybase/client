// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"path/filepath"
	"strings"

	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/ioutil"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/pkg/errors"
)

// blockDiskStore stores block data in flat files on disk.
//
// The directory layout looks like:
//
// dir/0100/0...01/data
// dir/0100/0...01/id
// dir/0100/0...01/ksh
// dir/0100/0...01/refs
// ...
// dir/01cc/5...55/id
// dir/01cc/5...55/refs
// ...
// dir/01dd/6...66/data
// dir/01dd/6...66/id
// dir/01dd/6...66/ksh
// ...
// dir/01ff/f...ff/data
// dir/01ff/f...ff/id
// dir/01ff/f...ff/ksh
// dir/01ff/f...ff/refs
//
// Each block has its own subdirectory with its ID truncated to 17
// bytes (34 characters) as a name. The block subdirectories are
// splayed over (# of possible hash types) * 256 subdirectories -- one
// byte for the hash type (currently only one) plus the first byte of
// the hash data -- using the first four characters of the name to
// keep the number of directories in dir itself to a manageable
// number, similar to git.
//
// Each block directory has the following files:
//
//   - id:   The full block ID in binary format. Always present.
//   - data: The raw block data that should hash to the block ID.
//           May be missing.
//   - ksh:  The raw data for the associated key server half.
//           May be missing, but should be present when data is.
//   - refs: The list of references to the block, along with other
//           block-specific info, encoded as a serialized
//           blockJournalInfo. May be missing.  TODO: rename this to
//           something more generic if we ever upgrade the journal
//           version.
//
// Future versions of the disk store might add more files to this
// directory; if any code is written to move blocks around, it should
// be careful to preserve any unknown files in a block directory.
//
// The maximum number of characters added to the root dir by a block
// disk store is 44:
//
//   /01ff/f...(30 characters total)...ff/data
//
// blockDiskStore is not goroutine-safe, so any code that uses it must
// guarantee that only one goroutine at a time calls its functions.
type blockDiskStore struct {
	codec kbfscodec.Codec
	dir   string
}

// filesPerBlockMax is an upper bound for the number of files
// (including directories) to store one block: 4 for the regular
// files, 2 for the (splayed) directories, and 1 for the journal
// entry.
const filesPerBlockMax = 7

// makeBlockDiskStore returns a new blockDiskStore for the given
// directory.
func makeBlockDiskStore(codec kbfscodec.Codec, dir string) *blockDiskStore {
	return &blockDiskStore{
		codec: codec,
		dir:   dir,
	}
}

// The functions below are for building various paths.

func (s *blockDiskStore) blockPath(id kbfsblock.ID) string {
	// Truncate to 34 characters, which corresponds to 16 random
	// bytes (since the first byte is a hash type) or 128 random
	// bits, which means that the expected number of blocks
	// generated before getting a path collision is 2^64 (see
	// https://en.wikipedia.org/wiki/Birthday_problem#Cast_as_a_collision_problem
	// ).
	idStr := id.String()
	return filepath.Join(s.dir, idStr[:4], idStr[4:34])
}

func (s *blockDiskStore) dataPath(id kbfsblock.ID) string {
	return filepath.Join(s.blockPath(id), "data")
}

const idFilename = "id"

func (s *blockDiskStore) idPath(id kbfsblock.ID) string {
	return filepath.Join(s.blockPath(id), idFilename)
}

func (s *blockDiskStore) keyServerHalfPath(id kbfsblock.ID) string {
	return filepath.Join(s.blockPath(id), "ksh")
}

func (s *blockDiskStore) infoPath(id kbfsblock.ID) string {
	// TODO: change the file name to "info" the next we change the
	// journal layout.
	return filepath.Join(s.blockPath(id), "refs")
}

// makeDir makes the directory for the given block ID and writes the
// ID file, if necessary.
func (s *blockDiskStore) makeDir(id kbfsblock.ID) error {
	err := ioutil.MkdirAll(s.blockPath(id), 0700)
	if err != nil {
		return err
	}

	// TODO: Only write if the file doesn't exist.

	return ioutil.WriteFile(s.idPath(id), []byte(id.String()), 0600)
}

// blockJournalInfo contains info about a particular block in the
// journal, such as the set of references to it.
type blockJournalInfo struct {
	Refs    blockRefMap
	Flushed bool `codec:"f,omitempty"`

	codec.UnknownFieldSetHandler
}

// TODO: Add caching for refs

// getRefInfo returns the references for the given ID.
func (s *blockDiskStore) getInfo(id kbfsblock.ID) (blockJournalInfo, error) {
	var info blockJournalInfo
	err := kbfscodec.DeserializeFromFile(s.codec, s.infoPath(id), &info)
	if !ioutil.IsNotExist(err) && err != nil {
		return blockJournalInfo{}, err
	}

	if info.Refs == nil {
		info.Refs = make(blockRefMap)
	}

	return info, nil
}

// putRefInfo stores the given references for the given ID.
func (s *blockDiskStore) putInfo(id kbfsblock.ID, info blockJournalInfo) error {
	return kbfscodec.SerializeToFile(s.codec, info, s.infoPath(id))
}

// addRefs adds references for the given contexts to the given ID, all
// with the same status and tag.
func (s *blockDiskStore) addRefs(id kbfsblock.ID, contexts []kbfsblock.Context,
	status blockRefStatus, tag string) error {
	info, err := s.getInfo(id)
	if err != nil {
		return err
	}

	if len(info.Refs) > 0 {
		// Check existing contexts, if any.
		for _, context := range contexts {
			_, err := info.Refs.checkExists(context)
			if err != nil {
				return err
			}
		}
	}

	for _, context := range contexts {
		err = info.Refs.put(context, status, tag)
		if err != nil {
			return err
		}
	}

	return s.putInfo(id, info)
}

// getData returns the data and server half for the given ID, if
// present.
func (s *blockDiskStore) getData(id kbfsblock.ID) (
	[]byte, kbfscrypto.BlockCryptKeyServerHalf, error) {
	data, err := ioutil.ReadFile(s.dataPath(id))
	if ioutil.IsNotExist(err) {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{},
			blockNonExistentError{id}
	} else if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
	}

	keyServerHalfPath := s.keyServerHalfPath(id)
	buf, err := ioutil.ReadFile(keyServerHalfPath)
	if ioutil.IsNotExist(err) {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{},
			blockNonExistentError{id}
	} else if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
	}

	// Check integrity.

	err = kbfsblock.VerifyID(data, id)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
	}

	var serverHalf kbfscrypto.BlockCryptKeyServerHalf
	err = serverHalf.UnmarshalBinary(buf)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
	}

	return data, serverHalf, nil
}

// All functions below are public functions.

func (s *blockDiskStore) hasAnyRef(id kbfsblock.ID) (bool, error) {
	info, err := s.getInfo(id)
	if err != nil {
		return false, err
	}

	return len(info.Refs) > 0, nil
}

func (s *blockDiskStore) hasNonArchivedRef(id kbfsblock.ID) (bool, error) {
	info, err := s.getInfo(id)
	if err != nil {
		return false, err
	}

	return info.Refs.hasNonArchivedRef(), nil
}

func (s *blockDiskStore) hasContext(id kbfsblock.ID, context kbfsblock.Context) (
	bool, error) {
	info, err := s.getInfo(id)
	if err != nil {
		return false, err
	}

	return info.Refs.checkExists(context)
}

func (s *blockDiskStore) hasData(id kbfsblock.ID) (bool, error) {
	_, err := ioutil.Stat(s.dataPath(id))
	if ioutil.IsNotExist(err) {
		return false, nil
	} else if err != nil {
		return false, err
	}
	return true, nil
}

func (s *blockDiskStore) isUnflushed(id kbfsblock.ID) (bool, error) {
	ok, err := s.hasData(id)
	if err != nil {
		return false, err
	}

	if !ok {
		return false, nil
	}

	// The data is there; has it been flushed?
	info, err := s.getInfo(id)
	if err != nil {
		return false, err
	}

	return !info.Flushed, nil
}

func (s *blockDiskStore) markFlushed(id kbfsblock.ID) error {
	info, err := s.getInfo(id)
	if err != nil {
		return err
	}

	info.Flushed = true
	return s.putInfo(id, info)
}

func (s *blockDiskStore) getDataSize(id kbfsblock.ID) (int64, error) {
	fi, err := ioutil.Stat(s.dataPath(id))
	if ioutil.IsNotExist(err) {
		return 0, nil
	} else if err != nil {
		return 0, err
	}
	return fi.Size(), nil
}

func (s *blockDiskStore) getDataWithContext(id kbfsblock.ID, context kbfsblock.Context) (
	[]byte, kbfscrypto.BlockCryptKeyServerHalf, error) {
	hasContext, err := s.hasContext(id, context)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
	}
	if !hasContext {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{},
			blockNonExistentError{id}
	}

	return s.getData(id)
}

func (s *blockDiskStore) getAllRefsForTest() (map[kbfsblock.ID]blockRefMap, error) {
	res := make(map[kbfsblock.ID]blockRefMap)

	fileInfos, err := ioutil.ReadDir(s.dir)
	if ioutil.IsNotExist(err) {
		return res, nil
	} else if err != nil {
		return nil, err
	}

	for _, fi := range fileInfos {
		name := fi.Name()
		if !fi.IsDir() {
			return nil, errors.Errorf("Unexpected non-dir %q", name)
		}

		subFileInfos, err := ioutil.ReadDir(filepath.Join(s.dir, name))
		if err != nil {
			return nil, err
		}

		for _, sfi := range subFileInfos {
			subName := sfi.Name()
			if !sfi.IsDir() {
				return nil, errors.Errorf("Unexpected non-dir %q",
					subName)
			}

			idPath := filepath.Join(
				s.dir, name, subName, idFilename)
			idBytes, err := ioutil.ReadFile(idPath)
			if err != nil {
				return nil, err
			}

			id, err := kbfsblock.IDFromString(string(idBytes))
			if err != nil {
				return nil, errors.WithStack(err)
			}

			if !strings.HasPrefix(id.String(), name+subName) {
				return nil, errors.Errorf(
					"%q unexpectedly not a prefix of %q",
					name+subName, id.String())
			}

			info, err := s.getInfo(id)
			if err != nil {
				return nil, err
			}

			if len(info.Refs) > 0 {
				res[id] = info.Refs
			}
		}
	}

	return res, nil
}

// put puts the given data for the block, which may already exist, and
// adds a reference for the given context. If isRegularPut is true,
// additional validity checks are performed.  If err is nil, putData
// indicates whether the data didn't already exist and was put; if
// false, it means that the data already exists, but this might have
// added a new ref.
func (s *blockDiskStore) put(isRegularPut bool, id kbfsblock.ID, context kbfsblock.Context,
	buf []byte, serverHalf kbfscrypto.BlockCryptKeyServerHalf,
	tag string) (putData bool, err error) {
	err = validateBlockPut(isRegularPut, id, context, buf)
	if err != nil {
		return false, err
	}

	// Check the data and retrieve the server half, if they exist.
	_, existingServerHalf, err := s.getDataWithContext(id, context)
	var exists bool
	switch err.(type) {
	case blockNonExistentError:
		exists = false
	case nil:
		exists = true
	default:
		return false, err
	}

	if exists {
		// If the entry already exists, everything should be
		// the same, except for possibly additional
		// references.

		// We checked that both buf and the existing data hash
		// to id, so no need to check that they're both equal.

		if isRegularPut && existingServerHalf != serverHalf {
			return false, errors.Errorf(
				"key server half mismatch: expected %s, got %s",
				existingServerHalf, serverHalf)
		}
	} else {
		err = s.makeDir(id)
		if err != nil {
			return false, err
		}

		err = ioutil.WriteFile(s.dataPath(id), buf, 0600)
		if err != nil {
			return false, err
		}

		// TODO: Add integrity-checking for key server half?

		data, err := serverHalf.MarshalBinary()
		if err != nil {
			return false, err
		}
		err = ioutil.WriteFile(s.keyServerHalfPath(id), data, 0600)
		if err != nil {
			return false, err
		}
	}

	err = s.addRefs(id, []kbfsblock.Context{context}, liveBlockRef, tag)
	if err != nil {
		return false, err
	}

	return !exists, nil
}

func (s *blockDiskStore) addReference(
	id kbfsblock.ID, context kbfsblock.Context, tag string) error {
	err := s.makeDir(id)
	if err != nil {
		return err
	}

	return s.addRefs(id, []kbfsblock.Context{context}, liveBlockRef, tag)
}

func (s *blockDiskStore) archiveReferences(
	contexts kbfsblock.ContextMap, tag string) error {
	for id, idContexts := range contexts {
		err := s.makeDir(id)
		if err != nil {
			return err
		}

		err = s.addRefs(id, idContexts, archivedBlockRef, tag)
		if err != nil {
			return err
		}
	}

	return nil
}

// removeReferences removes references for the given contexts from
// their respective IDs. If tag is non-empty, then a reference will be
// removed only if its most recent tag (passed in to addRefs) matches
// the given one.
func (s *blockDiskStore) removeReferences(
	id kbfsblock.ID, contexts []kbfsblock.Context, tag string) (
	liveCount int, err error) {
	info, err := s.getInfo(id)
	if err != nil {
		return 0, err
	}
	if len(info.Refs) == 0 {
		return 0, nil
	}

	for _, context := range contexts {
		err := info.Refs.remove(context, tag)
		if err != nil {
			return 0, err
		}
		if len(info.Refs) == 0 {
			break
		}
	}

	err = s.putInfo(id, info)
	if err != nil {
		return 0, err
	}

	return len(info.Refs), nil
}

// remove removes any existing data for the given ID, which must not
// have any references left.
func (s *blockDiskStore) remove(id kbfsblock.ID) error {
	hasAnyRef, err := s.hasAnyRef(id)
	if err != nil {
		return err
	}
	if hasAnyRef {
		return errors.Errorf(
			"Trying to remove data for referenced block %s", id)
	}
	path := s.blockPath(id)

	err = ioutil.RemoveAll(path)
	if err != nil {
		return err
	}

	// Remove the parent (splayed) directory if it exists and is
	// empty.
	err = ioutil.Remove(filepath.Dir(path))
	if ioutil.IsNotExist(err) || ioutil.IsExist(err) {
		err = nil
	}
	return err
}

func (s blockDiskStore) clear() error {
	return ioutil.RemoveAll(s.dir)
}
