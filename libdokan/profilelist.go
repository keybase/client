// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package libdokan

import (
	"bytes"
	"regexp"
	"runtime/pprof"
	"time"

	"github.com/keybase/kbfs/dokan"
	"golang.org/x/net/context"
)

// TODO: Also have a file for CPU profiles.

// ProfileListDirName is the name of the KBFS profile directory -- it
// can be reached from any KBFS directory.
const ProfileListDirName = ".kbfs_profiles"

// ProfileList is a node that can list all of the available profiles.
type ProfileList struct {
	emptyFile
}

// GetFileInformation for dokan.
func (ProfileList) GetFileInformation(*dokan.FileInfo) (st *dokan.Stat, err error) {
	return defaultDirectoryInformation()
}

// open tries to open a file.
func (ProfileList) open(ctx context.Context, oc *openContext, path []string) (dokan.File, bool, error) {
	if len(path) == 0 {
		return oc.returnDirNoCleanup(ProfileList{})
	}
	if len(path) > 1 || !isSupportedProfileName(path[0]) {
		return nil, false, dokan.ErrObjectNameNotFound
	}
	p := pprof.Lookup(path[0])
	if p == nil {
		return nil, false, dokan.ErrObjectNameNotFound
	}
	debug := 1
	if path[0] == "goroutine" {
		debug = 2
	}
	return NewProfileFile(p, debug)
}

var profileNameRE = regexp.MustCompile("^[a-zA-Z0-9_]*$")

func isSupportedProfileName(name string) bool {
	// https://golang.org/pkg/runtime/pprof/#NewProfile recommends
	// using an import path for profile names. But supporting that
	// would require faking out sub-directories, too. For now,
	// just support alphanumeric filenames.
	return profileNameRE.MatchString(name)
}

// FindFiles does readdir for dokan.
func (ProfileList) FindFiles(fi *dokan.FileInfo, callback func(*dokan.NamedStat) error) (err error) {
	profiles := pprof.Profiles()
	var ns dokan.NamedStat
	ns.FileAttributes = fileAttributeReadonly
	ns.NumberOfLinks = 1
	for _, p := range profiles {
		ns.Name = p.Name()
		if !isSupportedProfileName(ns.Name) {
			continue
		}
		err := callback(&ns)
		if err != nil {
			return err
		}
	}
	return nil
}

// NewProfileFile returns a special read file that contains a text
// representation of the profile with the given name.
func NewProfileFile(p *pprof.Profile, debug int) (dokan.File, bool, error) {
	return &SpecialReadFile{
		read: func() ([]byte, time.Time, error) {
			var b bytes.Buffer
			err := p.WriteTo(&b, debug)
			if err != nil {
				return nil, time.Time{}, err
			}

			return b.Bytes(), time.Now(), nil
		},
	}, false, nil
}
