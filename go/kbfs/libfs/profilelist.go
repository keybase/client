// Copyright 2015-2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"bytes"
	"regexp"
	"runtime/pprof"
	"time"

	"golang.org/x/net/context"
)

// ProfileListDirName is the name of the KBFS profile directory -- it
// can be reached from any KBFS directory.
const ProfileListDirName = ".kbfs_profiles"

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
