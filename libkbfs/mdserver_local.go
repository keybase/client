package libkbfs

import (
	"crypto/rand"

	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/opt"
)

// MDServerLocal just stores blocks in a local leveldb instance
type MDServerLocal struct {
	config   Config
	handleDb *leveldb.DB // dir handle -> dirId
	idDb     *leveldb.DB // dirId -> MD ID
	mdDb     *leveldb.DB // MD ID -> root metadata (signed)
}

func NewMDServerLocal(config Config, handleDbfile string, idDbfile string,
	mdDbfile string) *MDServerLocal {
	handleDb, err := leveldb.OpenFile(handleDbfile, &opt.Options{
		Compression: opt.NoCompression,
	})
	if err != nil {
		return nil
	}
	idDb, err := leveldb.OpenFile(idDbfile, &opt.Options{
		Compression: opt.NoCompression,
	})
	if err != nil {
		return nil
	}
	mdDb, err := leveldb.OpenFile(mdDbfile, &opt.Options{
		Compression: opt.NoCompression,
	})
	if err != nil {
		return nil
	}
	return &MDServerLocal{config, handleDb, idDb, mdDb}
}

func (md *MDServerLocal) GetAtHandle(handle *DirHandle) (
	*RootMetadataSigned, error) {
	buf, err := md.handleDb.Get(handle.ToBytes(md.config), nil)
	var id DirId
	if err != leveldb.ErrNotFound {
		copy(id[:], buf[:len(id)])
		rmds, err := md.Get(id)
		return rmds, err
	} else {
		// make a new one
		var id DirId
		if _, err := rand.Read(id[0 : DIRID_LEN-1]); err != nil {
			return nil, err
		}
		if handle.IsPublic() {
			id[DIRID_LEN-1] = PUBDIRID_SUFFIX
		} else {
			id[DIRID_LEN-1] = DIRID_SUFFIX
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
			} else {
				return nil, &WriteAccessError{user.String(), dirstring}
			}
		}

		return &RootMetadataSigned{MD: *rmd}, nil
	}
}

func (md *MDServerLocal) Get(id DirId) (*RootMetadataSigned, error) {
	buf, err := md.idDb.Get(id[:], nil)
	var mdId MDId
	if err != leveldb.ErrNotFound {
		copy(mdId[:], buf[:len(mdId)])
		return md.GetAtId(id, mdId)
	} else {
		return nil, err
	}
}

func (md *MDServerLocal) GetAtId(id DirId, mdId MDId) (
	*RootMetadataSigned, error) {
	buf, err := md.mdDb.Get(append(mdId[:], id[:]...), nil)
	if err != nil {
		return nil, err
	}
	rmds := NewRootMetadataSigned()
	err = md.config.Codec().Decode(buf, rmds)
	return rmds, err
}

func (md *MDServerLocal) Put(id DirId, mdId MDId,
	rmds *RootMetadataSigned) error {
	if buf, err := md.config.Codec().Encode(rmds); err == nil {
		// The dir ID points to the current MD block ID, and the
		// dir ID + MD ID points to the buffer
		mdIdBytes := mdId[:]
		dirIdBytes := id[:]
		handleBytes := rmds.MD.GetDirHandle().ToBytes(md.config)
		err = md.mdDb.Put(append(mdIdBytes, dirIdBytes...), buf, nil)
		if err != nil {
			return err
		}
		err = md.idDb.Put(dirIdBytes, mdIdBytes, nil)
		if err != nil {
			return err
		}
		return md.handleDb.Put(handleBytes, dirIdBytes, nil)
	} else {
		return err
	}
}

func (md *MDServerLocal) GetFavorites() ([]DirId, error) {
	iter := md.idDb.NewIterator(nil, nil)
	output := make([]DirId, 0, 1)
	for i := 0; iter.Next(); i++ {
		key := iter.Key()
		var id DirId
		copy(id[:], key[:len(id)])
		if !id.IsPublic() {
			output = append(output, id)
		}
	}
	iter.Release()
	err := iter.Error()
	return output, err
}
