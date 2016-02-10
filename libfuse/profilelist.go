package libfuse

import (
	"bytes"
	"os"
	"regexp"
	"runtime/pprof"
	"time"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"golang.org/x/net/context"
)

// TODO: Also have a file for CPU profiles.

// ProfileListDirName is the name of the KBFS profile directory -- it
// can be reached from any KBFS directory.
const ProfileListDirName = ".kbfs_profiles"

// ProfileList is a node that can list all of the available profiles.
type ProfileList struct{}

var _ fs.Node = ProfileList{}

// Attr implements the fs.Node interface.
func (ProfileList) Attr(_ context.Context, a *fuse.Attr) error {
	a.Mode = os.ModeDir | 0755
	return nil
}

var _ fs.NodeRequestLookuper = ProfileList{}

// Lookup implements the fs.NodeRequestLookuper interface.
func (pl ProfileList) Lookup(_ context.Context, req *fuse.LookupRequest, resp *fuse.LookupResponse) (node fs.Node, err error) {
	p := pprof.Lookup(req.Name)
	if p == nil {
		return nil, fuse.ENOENT
	}

	// See https://golang.org/pkg/runtime/pprof/#Profile.WriteTo
	// for the meaning of debug.
	debug := 1
	if req.Name == "goroutine" {
		debug = 2
	}

	return NewProfileFile(p, resp, debug), nil
}

var _ fs.Handle = ProfileList{}

var _ fs.HandleReadDirAller = ProfileList{}

var profileNameRE = regexp.MustCompile("^[a-zA-Z0-9_]*$")

func isSupportedProfileName(name string) bool {
	// https://golang.org/pkg/runtime/pprof/#NewProfile recommends
	// using an import path for profile names. But supporting that
	// would require faking out sub-directories, too. For now,
	// just support alphanumeric filenames.
	return profileNameRE.MatchString(name)
}

// ReadDirAll implements the ReadDirAll interface.
func (pl ProfileList) ReadDirAll(_ context.Context) (res []fuse.Dirent, err error) {
	profiles := pprof.Profiles()
	res = make([]fuse.Dirent, 0, len(profiles))
	for _, p := range profiles {
		name := p.Name()
		if !isSupportedProfileName(name) {
			continue
		}
		res = append(res, fuse.Dirent{
			Type: fuse.DT_Dir,
			Name: name,
		})
	}
	return res, nil
}

var _ fs.NodeRemover = (*FolderList)(nil)

// Remove implements the fs.NodeRemover interface for ProfileList.
func (ProfileList) Remove(_ context.Context, req *fuse.RemoveRequest) (err error) {
	return fuse.EPERM
}

// NewProfileFile returns a special read file that contains a text
// representation of the profile with the given name.
func NewProfileFile(p *pprof.Profile, resp *fuse.LookupResponse, debug int) *SpecialReadFile {
	resp.EntryValid = 0
	return &SpecialReadFile{
		read: func(_ context.Context) ([]byte, time.Time, error) {
			var b bytes.Buffer
			err := p.WriteTo(&b, debug)
			if err != nil {
				return nil, time.Time{}, err
			}

			return b.Bytes(), time.Now(), nil
		},
	}
}
