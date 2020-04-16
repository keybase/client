// Copyright 2015-2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"bytes"
	"context"
	"io"
	"os"
	"regexp"
	"runtime/pprof"
	"runtime/trace"
	"strings"
	"time"

	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/pkg/errors"
	billy "gopkg.in/src-d/go-billy.v4"
)

const (
	// CPUProfilePrefix is the prefix to a CPU profile file (a
	// duration should follow the prefix in the actual file name).
	CPUProfilePrefix = "profile."

	// TraceProfilePrefix is the prefix to a trace profile file (a
	// duration should follow the prefix in the actual file name).
	TraceProfilePrefix = "trace."
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

// ProfileGet gets the relevant read function for the profile or nil if it doesn't exist.
func ProfileGet(name string) func(context.Context) ([]byte, time.Time, error) {
	p := pprof.Lookup(name)
	if p == nil {
		return nil
	}

	// See https://golang.org/pkg/runtime/pprof/#Profile.WriteTo
	// for the meaning of debug.
	debug := 1
	if name == "goroutine" {
		debug = 2
	}
	return profileRead(p, debug)
}

// profileRead reads from a Profile.
func profileRead(p *pprof.Profile, debug int) func(context.Context) ([]byte, time.Time, error) {
	return func(_ context.Context) ([]byte, time.Time, error) {
		var b bytes.Buffer
		err := p.WriteTo(&b, debug)
		if err != nil {
			return nil, time.Time{}, err
		}

		return b.Bytes(), time.Now(), nil
	}
}

var profileNameRE = regexp.MustCompile("^[a-zA-Z0-9_]*$")

// IsSupportedProfileName matches a string against allowed profile names.
func IsSupportedProfileName(name string) bool {
	// https://golang.org/pkg/runtime/pprof/#NewProfile recommends
	// using an import path for profile names. But supporting that
	// would require faking out sub-directories, too. For now,
	// just support alphanumeric filenames.
	return profileNameRE.MatchString(name)
}

// ProfileFS provides an easy way to browse the go profiles.
type ProfileFS struct {
	config libkbfs.Config
}

// NewProfileFS returns a read-only filesystem for browsing profiles.
func NewProfileFS(config libkbfs.Config) ProfileFS {
	return ProfileFS{config}
}

var _ libkbfs.NodeFSReadOnly = ProfileFS{}

// Lstat implements the libkbfs.NodeFSReadOnly interface.
func (pfs ProfileFS) Lstat(filename string) (os.FileInfo, error) {
	if strings.HasPrefix(filename, CPUProfilePrefix) ||
		strings.HasPrefix(filename, TraceProfilePrefix) {
		// Set profile sizes to 0 because it's too expensive to read them
		// ahead of time.
		return &wrappedReadFileInfo{filename, 0, time.Now(), false}, nil
	}

	if !IsSupportedProfileName(filename) {
		return nil, errors.Errorf("Unsupported profile %s", filename)
	}

	f := ProfileGet(filename)
	// Get the data, just for the size.
	b, t, err := f(context.Background())
	if err != nil {
		return nil, err
	}
	return &wrappedReadFileInfo{filename, int64(len(b)), t, false}, nil
}

// ListProfileNames returns the name of all profiles to list.
func ListProfileNames() (res []string) {
	profiles := pprof.Profiles()
	res = make([]string, 0, len(profiles)+2)
	for _, p := range profiles {
		name := p.Name()
		if !IsSupportedProfileName(name) {
			continue
		}
		res = append(res, name)
	}
	res = append(res, CPUProfilePrefix+"30s")
	res = append(res, TraceProfilePrefix+"30s")
	return res
}

// ReadDir implements the libkbfs.NodeFSReadOnly interface.
func (pfs ProfileFS) ReadDir(path string) ([]os.FileInfo, error) {
	if path != "" && path != "." {
		return nil, errors.New("Can't read subdirectories in profile list")
	}

	profiles := ListProfileNames()
	res := make([]os.FileInfo, 0, len(profiles))
	for _, p := range profiles {
		fi, err := pfs.Lstat(p)
		if err != nil {
			return nil, err
		}
		res = append(res, fi)
	}
	return res, nil
}

// Readlink implements the libkbfs.NodeFSReadOnly interface.
func (pfs ProfileFS) Readlink(_ string) (string, error) {
	return "", errors.New("Readlink not supported")
}

func (pfs ProfileFS) openTimedProfile(
	ctx context.Context, durationStr string, prof timedProfile) (
	[]byte, error) {
	duration, err := time.ParseDuration(durationStr)
	if err != nil {
		return nil, err
	}

	// TODO: Blocking here until the profile is done is
	// weird. Blocking on read is better.
	//
	// TODO: Maybe keep around a special last_profile file to be able
	// to start capturing a profile and then interrupt when done,
	// which would also be useful in general, since you'd be able to
	// save a profile even if you open it up with a tool.
	var buf bytes.Buffer
	err = prof.Start(&buf)
	if err != nil {
		return nil, err
	}

	defer prof.Stop()

	select {
	case <-time.After(duration):
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	prof.Stop()

	return buf.Bytes(), nil
}

// OpenWithContext opens a profile, with a custom context.
func (pfs ProfileFS) OpenWithContext(
	ctx context.Context, filename string) (billy.File, error) {
	var durationStr string
	var prof timedProfile
	if strings.HasPrefix(filename, CPUProfilePrefix) {
		durationStr = strings.TrimPrefix(filename, CPUProfilePrefix)
		prof = cpuProfile{}
	} else if strings.HasPrefix(filename, TraceProfilePrefix) {
		durationStr = strings.TrimPrefix(filename, TraceProfilePrefix)
		prof = traceProfile{}
	}
	if durationStr != "" {
		// Read and cache the timed profiles contents on open, so we
		// don't re-do it on every read.
		b, err := pfs.openTimedProfile(ctx, durationStr, prof)
		if err != nil {
			return nil, err
		}
		now := pfs.config.Clock().Now()
		return &wrappedReadFile{
			filename,
			func(_ context.Context) ([]byte, time.Time, error) {
				return b, now, nil
			},
			pfs.config.MakeLogger(""),
			0}, nil
	}

	if !IsSupportedProfileName(filename) {
		return nil, errors.Errorf("Unsupported profile %s", filename)
	}

	f := ProfileGet(filename)
	return &wrappedReadFile{filename, f, pfs.config.MakeLogger(""), 0}, nil
}

// Open implements the libkbfs.NodeFSReadOnly interface.
func (pfs ProfileFS) Open(filename string) (billy.File, error) {
	// TODO: we should figure out some way to route the actual
	// request context here if at all possible, so we can end
	// early if it's canceled.
	return pfs.OpenWithContext(context.TODO(), filename)
}

// OpenFile implements the libkbfs.NodeFSReadOnly interface.
func (pfs ProfileFS) OpenFile(
	filename string, flag int, _ os.FileMode) (billy.File, error) {
	if flag&os.O_CREATE != 0 {
		return nil, errors.New("read-only filesystem")
	}

	return pfs.Open(filename)
}
