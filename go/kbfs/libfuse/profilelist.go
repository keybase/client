// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build !windows

package libfuse

import (
	"bytes"
	"io"
	"os"
	"runtime/pprof"
	"runtime/trace"
	"strings"
	"time"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/client/go/kbfs/libfs"

	"golang.org/x/net/context"
)

type timedProfile interface {
	Start(w io.Writer) error
	Stop()
}

type cpuProfile struct{}

func (p cpuProfile) Start(w io.Writer) error {
	return pprof.StartCPUProfile(w)
}

func (p cpuProfile) Stop() {
	pprof.StopCPUProfile()
}

type traceProfile struct{}

func (p traceProfile) Start(w io.Writer) error {
	return trace.Start(w)
}

func (p traceProfile) Stop() {
	trace.Stop()
}

// timedProfileFile represents a file whose contents are determined by
// taking a profile for some duration.
type timedProfileFile struct {
	duration time.Duration
	profile  timedProfile
}

var _ fs.Node = timedProfileFile{}

func (f timedProfileFile) Attr(ctx context.Context, a *fuse.Attr) error {
	// Have a low non-zero value for Valid to avoid being swamped
	// with requests.
	a.Valid = 1 * time.Second
	now := time.Now()
	a.Size = 0
	a.Mtime = now
	a.Ctime = now
	a.Mode = 0444
	return nil
}

var _ fs.NodeOpener = timedProfileFile{}

func (f timedProfileFile) Open(ctx context.Context,
	req *fuse.OpenRequest, resp *fuse.OpenResponse) (fs.Handle, error) {
	// TODO: Blocking here until the profile is done is
	// weird. Blocking on read is better.
	//
	// TODO: Maybe keep around a special last_profile file to be
	// able to start capturing a profile and then interrupt when
	// done, which would also be useful in general, since you be
	// able to save a profile even if you open it up with a tool.
	var buf bytes.Buffer
	err := f.profile.Start(&buf)
	if err != nil {
		return nil, err
	}

	defer f.profile.Stop()

	select {
	case <-time.After(f.duration):
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	f.profile.Stop()

	resp.Flags |= fuse.OpenDirectIO
	return fs.DataHandle(buf.Bytes()), nil
}

// ProfileList is a node that can list all of the available profiles.
type ProfileList struct{}

var _ fs.Node = ProfileList{}

// Attr implements the fs.Node interface.
func (ProfileList) Attr(_ context.Context, a *fuse.Attr) error {
	a.Mode = os.ModeDir | 0755
	return nil
}

var _ fs.NodeRequestLookuper = ProfileList{}

const cpuProfilePrefix = "profile."
const traceProfilePrefix = "trace."

// Lookup implements the fs.NodeRequestLookuper interface.
func (pl ProfileList) Lookup(_ context.Context, req *fuse.LookupRequest, resp *fuse.LookupResponse) (node fs.Node, err error) {
	// Handle timed profiles first.
	if strings.HasPrefix(req.Name, cpuProfilePrefix) {
		durationStr := strings.TrimPrefix(req.Name, cpuProfilePrefix)
		duration, err := time.ParseDuration(durationStr)
		if err != nil {
			return nil, err
		}

		return timedProfileFile{duration, cpuProfile{}}, nil
	} else if strings.HasPrefix(req.Name, traceProfilePrefix) {
		durationStr := strings.TrimPrefix(req.Name, traceProfilePrefix)
		duration, err := time.ParseDuration(durationStr)
		if err != nil {
			return nil, err
		}
		return timedProfileFile{duration, traceProfile{}}, nil
	}

	f := libfs.ProfileGet(req.Name)
	if f == nil {
		return nil, fuse.ENOENT
	}
	resp.EntryValid = 0
	return &SpecialReadFile{read: f}, nil
}

var _ fs.Handle = ProfileList{}

var _ fs.HandleReadDirAller = ProfileList{}

// ReadDirAll implements the ReadDirAll interface.
func (pl ProfileList) ReadDirAll(_ context.Context) (res []fuse.Dirent, err error) {
	profiles := pprof.Profiles()
	res = make([]fuse.Dirent, 0, len(profiles))
	for _, p := range profiles {
		name := p.Name()
		if !libfs.IsSupportedProfileName(name) {
			continue
		}
		res = append(res, fuse.Dirent{
			Type: fuse.DT_File,
			Name: name,
		})
	}
	res = append(res, fuse.Dirent{
		Type: fuse.DT_File,
		Name: cpuProfilePrefix + "30s",
	})
	res = append(res, fuse.Dirent{
		Type: fuse.DT_File,
		Name: traceProfilePrefix + "1s",
	})
	return res, nil
}

var _ fs.NodeRemover = (*FolderList)(nil)

// Remove implements the fs.NodeRemover interface for ProfileList.
func (ProfileList) Remove(_ context.Context, req *fuse.RemoveRequest) (err error) {
	return fuse.EPERM
}
