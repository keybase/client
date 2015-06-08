package libkbfs

import (
	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/opt"
	"github.com/syndtr/goleveldb/leveldb/storage"
)

// MDServerLocal just stores blocks in local leveldb instances.
type MDServerLocal struct {
	config   Config
	handleDb *leveldb.DB // dir handle -> dirId
	idDb     *leveldb.DB // dirId -> MD ID
	mdDb     *leveldb.DB // MD ID -> root metadata (signed)
}

func newMDServerLocalWithStorage(config Config, handleStorage, idStorage, mdStorage storage.Storage) (*MDServerLocal, error) {
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
	mdserv := &MDServerLocal{config, handleDb, idDb, mdDb}
	return mdserv, nil
}

// NewMDServerLocal constructs a new MDServerLocal object that stores
// data in the directories specified as parameters to this function.
func NewMDServerLocal(config Config, handleDbfile string, idDbfile string,
	mdDbfile string) (*MDServerLocal, error) {
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

	return newMDServerLocalWithStorage(config, handleStorage, idStorage, mdStorage)
}

// NewMDServerMemory constructs a new MDServerLocal object that stores
// all data in-memory.
func NewMDServerMemory(config Config) (*MDServerLocal, error) {
	return newMDServerLocalWithStorage(config, storage.NewMemStorage(), storage.NewMemStorage(), storage.NewMemStorage())
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
	buf, err := md.mdDb.Get(append(mdID[:], id[:]...), nil)
	if err != nil {
		return nil, err
	}
	var rmds RootMetadataSigned
	err = md.config.Codec().Decode(buf, &rmds)
	return &rmds, err
}

// Put implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) Put(id DirID, mdID MdID,
	rmds *RootMetadataSigned) error {
	buf, err := md.config.Codec().Encode(rmds)
	if err != nil {
		return err
	}

	// The dir ID points to the current MD block ID, and the
	// dir ID + MD ID points to the buffer
	mdIDBytes := mdID[:]
	dirIDBytes := id[:]
	handleBytes := rmds.MD.GetDirHandle().ToBytes(md.config)
	err = md.mdDb.Put(append(mdIDBytes, dirIDBytes...), buf, nil)
	if err != nil {
		return err
	}
	err = md.idDb.Put(dirIDBytes, mdIDBytes, nil)
	if err != nil {
		return err
	}
	return md.handleDb.Put(handleBytes, dirIDBytes, nil)
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
