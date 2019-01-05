// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package config

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
)

// DefaultConfigFilename is the default filename for Keybase Pages config file.
const DefaultConfigFilename = ".kbp_config"

// DefaultConfigFilepath is the default path for Keybase Pages config file
// under the site root, and is what's used in kbpagesd.
const DefaultConfigFilepath = "/.kbp_config"

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
	VersionUnknown Version = iota
	// Version1 is version 1.
	Version1
	// Version2 is version 2.
	//
	// Currently the only difference between V1 and V2 is that V2 uses
	// sha-based password hash instead of bcrypt in V1. V2 still uses the ACL
	// definition and checker from V1.
	Version2
)
const (
	// VersionUnknownStr is the string representation of VUnknown.
	VersionUnknownStr string = "unknown"
	// Version1Str is the string representation of Version1.
	Version1Str string = "v1"
	// Version2Str is the string representation of Version2.
	Version2Str string = "v2"
)

func (v Version) String() string {
	switch v {
	case Version1:
		return Version1Str
	case Version2:
		return Version2Str
	default:
		return VersionUnknownStr
	}

}

func parseVersion(s string) (Version, error) {
	switch s {
	case Version1Str:
		return Version1, nil
	case Version2Str:
		return Version2, nil
	default:
		return VersionUnknown, ErrInvalidVersion{s}
	}
}

// Config is a collection of methods for getting different configuration
// parameters.
type Config interface {
	Version() Version
	Authenticate(ctx context.Context, username, password string) bool
	// GetPermissions returns permission info. If username is nil, anonymous
	// permissions are returned. Otherwise, permissions for *username is
	// returned. Additionally, "maximum possible permissions" are returned,
	// which indicates whether a permission (read or list) is possible to be
	// granted on the path if proper authentication is provided.
	GetPermissions(path string, username *string) (
		read, list bool,
		possibleRead, possibleList bool,
		realm string, err error)

	Encode(w io.Writer, prettify bool) error
}

// ParseConfig parses a config from reader, and initializes internal checker(s)
// in the config.
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
