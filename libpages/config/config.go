// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package config

import (
	"bytes"
	"encoding/json"
	"io"
)

// Common includes common fields that should appear in all versions of
// configs.
type Common struct {
	// Version specifies the version of the config.
	Version string `json:"version"`
}

// Version specifies the version of a config.
type Version int

const (
	// VersionUnknown defines an unknown config version.
	VersionUnknown = iota
	// Version1 is version 1.
	Version1
)
const (
	// VersionUnknownStr is the string representation of VUnknown.
	VersionUnknownStr string = "unknown"
	// Version1Str is the string representation of Version1.
	Version1Str string = "v1"
)

func (v Version) String() string {
	switch v {
	case Version1:
		return Version1Str
	default:
		return VersionUnknownStr
	}

}

func parseVersion(s string) (Version, error) {
	switch s {
	case Version1Str:
		return Version1, nil
	default:
		return VersionUnknown, ErrInvalidVersion{s}
	}
}

// Config is a collection of methods for getting different configuration
// parameters.
type Config interface {
	Version() Version
	Authenticate(username, password string) bool
	GetPermissionsForAnonymous(path string) (read, list bool, realm string, err error)
	GetPermissionsForUsername(
		path, username string) (read, list bool, realm string, err error)
}

// ParseConfig parses a config from reader.
func ParseConfig(reader io.Reader) (config Config, err error) {
	// TODO: make a better decoder to avoid having a buffer here and decoding
	// twice.
	buf := &bytes.Buffer{}
	var common Common
	err = json.NewDecoder(io.TeeReader(reader, buf)).Decode(&common)
	if err != nil {
		return nil, err
	}
	v, err := parseVersion(common.Version)
	if err != nil {
		return nil, err
	}
	switch v {
	case Version1:
		var v1 V1
		err = json.NewDecoder(buf).Decode(&v1)
		if err != nil {
			return nil, err
		}
		return &v1, (&v1).EnsureInit()
	default:
		return nil, ErrInvalidVersion{}
	}
}
