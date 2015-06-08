package libkbfs

import "fmt"

type idPair struct {
	id   DirID
	mdID MdID
}

// FakeMDServer just stores blocks in maps.
type FakeMDServer struct {
	config Config
	dirIds map[string]DirID // dir handle -> dirId
	mdIDs  map[DirID]MdID
	rmdss  map[idPair]*RootMetadataSigned
}

// NewFakeMDServer constructs a new FakeMDServer.
func NewFakeMDServer(config Config) *FakeMDServer {
	dirIds := make(map[string]DirID)
	mdIDs := make(map[DirID]MdID)
	rmdss := make(map[idPair]*RootMetadataSigned)
	return &FakeMDServer{config, dirIds, mdIDs, rmdss}
}

// GetAtHandle implements the MDServer interface for FakeMDServer.
func (md *FakeMDServer) GetAtHandle(handle *DirHandle) (
	*RootMetadataSigned, error) {
	handleStr := string(handle.ToBytes(md.config))
	id, ok := md.dirIds[handleStr]
	if ok {
		return md.Get(id)
	}

	// Make a new one.
	if err := cryptoRandRead(id[0 : DirIDLen-1]); err != nil {
		return nil, err
	}
	if handle.IsPublic() {
		id[DirIDLen-1] = PubDirIDSuffix
	} else {
		id[DirIDLen-1] = DirIDSuffix
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

// Get implements the MDServer interface for FakeMDServer.
func (md *FakeMDServer) Get(id DirID) (*RootMetadataSigned, error) {
	mdID, ok := md.mdIDs[id]
	if ok {
		return md.GetAtID(id, mdID)
	}
	return nil, fmt.Errorf("Could not get metadata for %s", id)
}

// GetAtID implements the MDServer interface for FakeMDServer.
func (md *FakeMDServer) GetAtID(id DirID, mdID MdID) (
	*RootMetadataSigned, error) {
	rmd, ok := md.rmdss[idPair{id, mdID}]
	if ok {
		return rmd, nil
	}
	return nil, fmt.Errorf("Could not get metadata for %s/%s", id, mdID)
}

// Put implements the MDServer interface for FakeMDServer.
func (md *FakeMDServer) Put(id DirID, mdID MdID,
	rmds *RootMetadataSigned) error {
	md.rmdss[idPair{id, mdID}] = rmds
	md.mdIDs[id] = mdID
	handle := rmds.MD.GetDirHandle()
	handleStr := string(handle.ToBytes(md.config))
	md.dirIds[handleStr] = id
	return nil
}

// GetFavorites implements the MDServer interface for FakeMDServer.
func (md *FakeMDServer) GetFavorites() ([]DirID, error) {
	output := make([]DirID, 0, len(md.dirIds))
	for id := range md.mdIDs {
		if !id.IsPublic() {
			output = append(output, id)
		}
	}
	return output, nil
}
