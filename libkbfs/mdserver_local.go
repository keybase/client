package libkbfs

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/opt"
	"github.com/syndtr/goleveldb/leveldb/storage"
)

type unmergedDevInfo struct {
	Base MdID `codec:"b"`
	Head MdID `codec:"h"`
}

type unmergedInfo struct {
	Devices map[libkb.KIDMapKey]unmergedDevInfo
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

// GetAtHandle implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) GetAtHandle(handle *DirHandle) (
	*RootMetadataSigned, error) {
	buf, err := md.handleDb.Get(handle.ToBytes(md.config), nil)
	var id DirID
	if err != leveldb.ErrNotFound {
		copy(id[:], buf[:len(id)])
		return md.Get(id)
	}

	// Make a new one.
	id, err = md.config.Crypto().MakeRandomDirID(handle.IsPublic())
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
			return nil, &WriteAccessError{u.GetName(), dirstring}
		}
		return nil, &WriteAccessError{user.String(), dirstring}
	}

	return &RootMetadataSigned{MD: *rmd}, nil
}

// Get implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) Get(id DirID) (*RootMetadataSigned, error) {
	buf, err := md.idDb.Get(id[:], nil)
	var mdID MdID
	if err != leveldb.ErrNotFound {
		copy(mdID[:], buf[:len(mdID)])
		return md.GetAtID(id, mdID)
	}
	return nil, err
}

// GetAtID implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) GetAtID(id DirID, mdID MdID) (
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
func (md *MDServerLocal) getRange(id DirID, start MdID, end MdID, max int) (
	[]*RootMetadataSigned, bool, error) {
	// Make sure start exists in the db first
	if _, err := md.GetAtID(id, start); err != nil {
		return nil, false, err
	}

	if start == end {
		return nil, false, nil
	}

	// Without backpointers, let's do the dumb thing and go forwards
	// from 'end' until we find 'start'.
	var sinceRmds []*RootMetadataSigned
	rmds, err := md.GetAtID(id, end)
	if err != nil {
		return nil, false, err
	}
	for rmds.MD.PrevRoot != start {
		// prepend the new item, so that the order increases over time
		sinceRmds = append([]*RootMetadataSigned{rmds}, sinceRmds...)
		rmds, err = md.GetAtID(id, rmds.MD.PrevRoot)
		if err != nil {
			return nil, false, err
		}
	}
	sinceRmds = append([]*RootMetadataSigned{rmds}, sinceRmds...)

	return sinceRmds[:max], false, nil

}

// GetSince implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) GetSince(id DirID, mdID MdID, max int) (
	[]*RootMetadataSigned, bool, error) {
	rmds, err := md.Get(id)
	if err != nil {
		return nil, false, err
	}
	end, err := rmds.MD.MetadataID(md.config)
	if err != nil {
		return nil, false, err
	}

	return md.getRange(id, mdID, end, max)
}

func (md *MDServerLocal) put(id DirID, mdID MdID, rmds *RootMetadataSigned,
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

func (md *MDServerLocal) getUnmergedInfo(id DirID) (
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

// Put implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) Put(id DirID, deviceID libkb.KID, unmergedID MdID,
	mdID MdID, rmds *RootMetadataSigned) error {
	err := md.put(id, mdID, rmds, md.idDb, mdID[:])
	if err != nil {
		return err
	}
	handleBytes := rmds.MD.GetDirHandle().ToBytes(md.config)
	err = md.handleDb.Put(handleBytes, id[:], nil)
	if err != nil {
		return err
	}

	if deviceID == nil {
		// nothing to do if no unmerged device is specified
		return nil
	}

	// now clear out the unmerged history up to unmergedID
	exists, u, err := md.getUnmergedInfo(id)
	if err != nil || !exists {
		return err
	}
	devKey := deviceID.ToMapKey()
	devInfo, ok := u.Devices[devKey]
	if !ok {
		return fmt.Errorf("Missing unmerged info for device %v for folder %v",
			deviceID, id)
	}
	if devInfo.Head == unmergedID {
		// deleting the whole history
		delete(u.Devices, devKey)
	} else {
		devInfo.Base = unmergedID
		// at this point, the earliest link in the unmerged chain will
		// no longer point to a valid MdID (because the one it points
		// to got fixed up in the merge and removed from the unmerged
		// list).  That's unfortunate, but we can't clear the PrevRoot
		// because its included in the signature.
		u.Devices[devKey] = devInfo
	}

	ubytes, err := md.config.Codec().Encode(&u)
	if err != nil {
		return nil
	}
	return md.devDb.Put(id[:], ubytes, nil)
}

// PutUnmerged implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) PutUnmerged(id DirID, deviceID libkb.KID,
	mdID MdID, rmds *RootMetadataSigned) error {
	// First update the per-device unmerged info
	exists, u, err := md.getUnmergedInfo(id)
	if err != nil {
		return err
	} else if !exists {
		u = unmergedInfo{Devices: make(map[libkb.KIDMapKey]unmergedDevInfo)}
	}
	devKey := deviceID.ToMapKey()
	udev, ok := u.Devices[devKey]
	if !ok {
		udev = unmergedDevInfo{}
		// this must be the first branch from committed data
		udev.Base = rmds.MD.PrevRoot
	}
	udev.Head = mdID
	u.Devices[devKey] = udev
	ubytes, err := md.config.Codec().Encode(&u)
	if err != nil {
		return err
	}
	return md.put(id, mdID, rmds, md.devDb, ubytes)
}

// GetUnmergedSince implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) GetUnmergedSince(id DirID, deviceID libkb.KID,
	mdID MdID, max int) ([]*RootMetadataSigned, bool, error) {
	exists, u, err := md.getUnmergedInfo(id)
	if err != nil || !exists {
		return nil, false, err
	}
	devKey := deviceID.ToMapKey()
	udev, ok := u.Devices[devKey]
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
func (md *MDServerLocal) GetFavorites() ([]DirID, error) {
	iter := md.idDb.NewIterator(nil, nil)
	output := make([]DirID, 0, 1)
	for i := 0; iter.Next(); i++ {
		key := iter.Key()
		var id DirID
		copy(id[:], key[:len(id)])
		if !id.IsPublic() {
			output = append(output, id)
		}
	}
	iter.Release()
	err := iter.Error()
	return output, err
}
