package libkbfs

import (
	"fmt"

	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/opt"
	"github.com/syndtr/goleveldb/leveldb/storage"
)

type unmergedDevInfo struct {
	Base MdID `codec:"b"`
	Head MdID `codec:"h"`
}

type unmergedInfo struct {
	Devices map[keybase1.KID]unmergedDevInfo
}

// MDServerLocal just stores blocks in local leveldb instances.
type MDServerLocal struct {
	config   Config
	handleDb *leveldb.DB // dir handle -> dirId
	idDb     *leveldb.DB // dirId -> MD ID
	mdDb     *leveldb.DB // MD ID -> root metadata (signed)
	devDb    *leveldb.DB // dirId -> unmergedInfo
}

func newMDServerLocalWithStorage(config Config,
	handleStorage, idStorage, mdStorage, devStorage storage.Storage) (*MDServerLocal, error) {
	handleDb, err := leveldb.Open(handleStorage, &opt.Options{
		Compression: opt.NoCompression,
	})
	if err != nil {
		return nil, err
	}
	idDb, err := leveldb.Open(idStorage, &opt.Options{
		Compression: opt.NoCompression,
	})
	if err != nil {
		return nil, err
	}
	mdDb, err := leveldb.Open(mdStorage, &opt.Options{
		Compression: opt.NoCompression,
	})
	if err != nil {
		return nil, err
	}
	devDb, err := leveldb.Open(devStorage, &opt.Options{
		Compression: opt.NoCompression,
	})
	if err != nil {
		return nil, err
	}
	mdserv := &MDServerLocal{config, handleDb, idDb, mdDb, devDb}
	return mdserv, nil
}

// NewMDServerLocal constructs a new MDServerLocal object that stores
// data in the directories specified as parameters to this function.
func NewMDServerLocal(config Config, handleDbfile string, idDbfile string,
	mdDbfile string, devDbfile string) (*MDServerLocal, error) {
	handleStorage, err := storage.OpenFile(handleDbfile)
	if err != nil {
		return nil, err
	}

	idStorage, err := storage.OpenFile(idDbfile)
	if err != nil {
		return nil, err
	}

	mdStorage, err := storage.OpenFile(mdDbfile)
	if err != nil {
		return nil, err
	}

	devStorage, err := storage.OpenFile(devDbfile)
	if err != nil {
		return nil, err
	}

	return newMDServerLocalWithStorage(config, handleStorage,
		idStorage, mdStorage, devStorage)
}

// NewMDServerMemory constructs a new MDServerLocal object that stores
// all data in-memory.
func NewMDServerMemory(config Config) (*MDServerLocal, error) {
	return newMDServerLocalWithStorage(config, storage.NewMemStorage(),
		storage.NewMemStorage(), storage.NewMemStorage(),
		storage.NewMemStorage())
}

// GetForHandle implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) GetForHandle(handle *TlfHandle) (
	*RootMetadataSigned, error) {
	buf, err := md.handleDb.Get(handle.ToBytes(md.config), nil)
	var id TlfID
	if err != leveldb.ErrNotFound {
		copy(id[:], buf[:len(id)])
		return md.GetForTLF(id)
	}

	// Make a new one.
	id, err = md.config.Crypto().MakeRandomTlfID(handle.IsPublic())
	if err != nil {
		return nil, err
	}
	rmd := NewRootMetadata(handle, id)

	// only users with write permissions should be creating a new one
	user, err := md.config.KBPKI().GetLoggedInUser()
	if err != nil {
		return nil, err
	}
	if !handle.IsWriter(user) {
		dirstring := handle.ToString(md.config)
		if u, err2 := md.config.KBPKI().GetUser(user); err2 == nil {
			return nil, WriteAccessError{u.GetName(), dirstring}
		}
		return nil, WriteAccessError{user.String(), dirstring}
	}

	return &RootMetadataSigned{MD: *rmd}, nil
}

func (md *MDServerLocal) getHeadForTLF(id TlfID) (
	mdID MdID, err error) {
	buf, err := md.idDb.Get(id[:], nil)
	if err != nil {
		return
	}

	copy(mdID[:], buf[:len(mdID)])
	return
}

// GetForTLF implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) GetForTLF(id TlfID) (*RootMetadataSigned, error) {
	mdID, err := md.getHeadForTLF(id)
	if err != nil {
		return nil, err
	}
	return md.Get(mdID)
}

// Get implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) Get(mdID MdID) (
	*RootMetadataSigned, error) {
	buf, err := md.mdDb.Get(mdID[:], nil)
	if err != nil {
		return nil, err
	}
	var rmds RootMetadataSigned
	err = md.config.Codec().Decode(buf, &rmds)
	return &rmds, err
}

// getRange returns the consecutive (at most 'max') MD objects that
// begin just after 'start' and lead forward to (and including) 'end'.
func (md *MDServerLocal) getRange(id TlfID, start MdID, end MdID, max int) (
	sinceRmds []*RootMetadataSigned, hasMore bool, err error) {
	// Make sure start exists in the db first
	_, err = md.Get(start)
	if err != nil {
		return
	}

	if start == end {
		return
	}

	// Without backpointers, let's do the dumb thing and go forwards
	// from 'end' until we find 'start'.
	rmds, err := md.Get(end)
	if err != nil {
		return
	}
	tmp := []*RootMetadataSigned{rmds}
	for rmds.MD.PrevRoot != start {
		// append the newer item; we'll reverse the list later
		rmds, err = md.Get(rmds.MD.PrevRoot)
		if err != nil {
			return
		}
		tmp = append(tmp, rmds)
	}

	// reverse tmp, up to max items
	numSince := len(tmp)
	if numSince > max {
		numSince = max
	}
	sinceRmds = make([]*RootMetadataSigned, numSince)
	for i := 0; i < numSince; i++ {
		sinceRmds[i] = tmp[len(tmp)-1-i]
	}
	hasMore = numSince != len(tmp)
	return
}

// GetSince implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) GetSince(id TlfID, mdID MdID, max int) (
	[]*RootMetadataSigned, bool, error) {
	rmds, err := md.GetForTLF(id)
	if err != nil {
		return nil, false, err
	}
	end, err := rmds.MD.MetadataID(md.config)
	if err != nil {
		return nil, false, err
	}

	return md.getRange(id, mdID, end, max)
}

func (md *MDServerLocal) put(id TlfID, mdID MdID, rmds *RootMetadataSigned,
	iddb *leveldb.DB, idval []byte) error {
	buf, err := md.config.Codec().Encode(rmds)
	if err != nil {
		return err
	}

	// The dir ID points to the current MD block ID, and the
	// MD ID points to the buffer
	err = md.mdDb.Put(mdID[:], buf, nil)
	if err != nil {
		return err
	}
	return iddb.Put(id[:], idval, nil)
}

func (md *MDServerLocal) getUnmergedInfo(id TlfID) (
	exists bool, u unmergedInfo, err error) {
	var ubytes []byte
	ubytes, err = md.devDb.Get(id[:], nil)
	if err == leveldb.ErrNotFound {
		// just let exists=false tell the story
		err = nil
	} else if err == nil {
		err = md.config.Codec().Decode(ubytes, &u)
		if err != nil {
			return
		}
		exists = true
	}
	return
}

// Put implements the MDServer interface for MDServerLocal.  It does
// not check that unmergedBase is part of the unmerged history; it
// simply updates the unmerged base to that MdID without any
// verification.
func (md *MDServerLocal) Put(id TlfID, mdID MdID, rmds *RootMetadataSigned,
	deviceKID keybase1.KID, unmergedBase MdID) error {
	// First check to see that this MD is consistent with the current MD.
	currHead, err := md.getHeadForTLF(id)
	if err != nil && err != leveldb.ErrNotFound {
		return err
	} else if err == leveldb.ErrNotFound {
		currHead = NullMdID
	}

	if rmds.MD.PrevRoot != currHead {
		return OutOfDateMDError{rmds.MD.PrevRoot}
	}

	err = md.put(id, mdID, rmds, md.idDb, mdID[:])
	if err != nil {
		return err
	}
	handleBytes := rmds.MD.GetTlfHandle().ToBytes(md.config)
	err = md.handleDb.Put(handleBytes, id[:], nil)
	if err != nil {
		return err
	}

	if deviceKID.IsNil() {
		// nothing to do if no unmerged device is specified
		return nil
	}

	// now clear out the unmerged history up to unmergedID
	exists, u, err := md.getUnmergedInfo(id)
	if err != nil || !exists {
		// when no unmerged info exists for this folder, return err == nil
		return err
	}
	devInfo, ok := u.Devices[deviceKID]
	if !ok {
		// Technically could return nil here, but since this is a
		// local server that only supports one device, we should never
		// hit that case.
		return fmt.Errorf("Missing unmerged info for device %v for folder %v",
			deviceKID, id)
	}
	if devInfo.Head == unmergedBase {
		// deleting the whole history
		delete(u.Devices, deviceKID)
	} else {
		devInfo.Base = unmergedBase
		// at this point, the earliest link in the unmerged chain will
		// no longer point to a valid MdID (because the one it points
		// to got fixed up in the merge and removed from the unmerged
		// list).  That's unfortunate, but we can't clear the PrevRoot
		// because its included in the signature.
		u.Devices[deviceKID] = devInfo
	}

	ubytes, err := md.config.Codec().Encode(&u)
	if err != nil {
		return nil
	}
	return md.devDb.Put(id[:], ubytes, nil)
}

// PutUnmerged implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) PutUnmerged(id TlfID, mdID MdID,
	rmds *RootMetadataSigned, deviceKID keybase1.KID) error {
	// First update the per-device unmerged info
	exists, u, err := md.getUnmergedInfo(id)
	if err != nil {
		return err
	} else if !exists {
		u = unmergedInfo{Devices: make(map[keybase1.KID]unmergedDevInfo)}
	}
	udev, ok := u.Devices[deviceKID]
	if !ok {
		// this must be the first branch from committed data
		udev = unmergedDevInfo{Base: rmds.MD.PrevRoot}
	} else if rmds.MD.PrevRoot != udev.Head {
		return OutOfDateMDError{rmds.MD.PrevRoot}
	}

	udev.Head = mdID
	u.Devices[deviceKID] = udev
	ubytes, err := md.config.Codec().Encode(&u)
	if err != nil {
		return err
	}
	return md.put(id, mdID, rmds, md.devDb, ubytes)
}

// GetUnmergedSince implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) GetUnmergedSince(id TlfID, deviceKID keybase1.KID,
	mdID MdID, max int) ([]*RootMetadataSigned, bool, error) {
	exists, u, err := md.getUnmergedInfo(id)
	if err != nil || !exists {
		// if there's no unmerged info, just return err == nil
		return nil, false, err
	}
	udev, ok := u.Devices[deviceKID]
	if !ok {
		return nil, false, nil
	}

	// An empty mdID means to start from the beginning of the history
	start := mdID
	if start == NullMdID {
		start = udev.Base
	}

	return md.getRange(id, start, udev.Head, max)
}

// GetFavorites implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) GetFavorites() ([]TlfID, error) {
	iter := md.idDb.NewIterator(nil, nil)
	output := make([]TlfID, 0, 1)
	for i := 0; iter.Next(); i++ {
		key := iter.Key()
		var id TlfID
		copy(id[:], key[:len(id)])
		if !id.IsPublic() {
			output = append(output, id)
		}
	}
	iter.Release()
	err := iter.Error()
	return output, err
}
