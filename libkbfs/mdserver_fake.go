package libkbfs

import (
	"crypto/rand"
	"fmt"
)

type idPair struct {
	id   DirId
	mdId MDId
}

// FakeMDServer just stores blocks in maps.
type FakeMDServer struct {
	config Config
	dirIds map[string]DirId // dir handle -> dirId
	mdIds  map[DirId]MDId
	rmdss  map[idPair]*RootMetadataSigned
}

func NewFakeMDServer(config Config) *FakeMDServer {
	dirIds := make(map[string]DirId)
	mdIds := make(map[DirId]MDId)
	rmdss := make(map[idPair]*RootMetadataSigned)
	return &FakeMDServer{config, dirIds, mdIds, rmdss}
}

func (md *FakeMDServer) GetAtHandle(handle *DirHandle) (
	*RootMetadataSigned, error) {
	handleStr := string(handle.ToBytes(md.config))
	id, ok := md.dirIds[handleStr]
	if ok {
		return md.Get(id)
	}

	// Make a new one.
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

func (md *FakeMDServer) Get(id DirId) (*RootMetadataSigned, error) {
	mdId, ok := md.mdIds[id]
	if ok {
		return md.GetAtId(id, mdId)
	}
	return nil, fmt.Errorf("Could not get metadata for %s", id)
}

func (md *FakeMDServer) GetAtId(id DirId, mdId MDId) (
	*RootMetadataSigned, error) {
	rmd, ok := md.rmdss[idPair{id, mdId}]
	if ok {
		return rmd, nil
	}
	return nil, fmt.Errorf("Could not get metadata for %s/%s", id, mdId)
}

func (md *FakeMDServer) Put(id DirId, mdId MDId,
	rmds *RootMetadataSigned) error {
	md.rmdss[idPair{id, mdId}] = rmds
	md.mdIds[id] = mdId
	handle := rmds.MD.GetDirHandle()
	handleStr := string(handle.ToBytes(md.config))
	md.dirIds[handleStr] = id
	return nil
}

func (md *FakeMDServer) GetFavorites() ([]DirId, error) {
	output := make([]DirId, 0, len(md.dirIds))
	for id, _ := range md.mdIds {
		if !id.IsPublic() {
			output = append(output, id)
		}
	}
	return output, nil
}
