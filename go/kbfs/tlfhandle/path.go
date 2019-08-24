// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package tlfhandle

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/protocol/keybase1"
)

// PathType describes the types for different paths
type PathType string

const (
	// KeybasePathType is the keybase root (like /keybase)
	KeybasePathType PathType = "keybase"
	// PublicPathType is the keybase public folder list (like /keybase/public)
	PublicPathType PathType = "public"
	// PrivatePathType is the keybase private folder list (like
	// /keybase/private)
	PrivatePathType PathType = "private"
	// SingleTeamPathType is the keybase team folder list (like /keybase/teams)
	SingleTeamPathType PathType = "team"
)

// BuildCanonicalPath returns a canonical path for a path components.
// This a canonical path and may need to be converted to a platform
// specific path, for example, on Windows, this might correspond to
// k:\private\username. Note that "canonical" here indicates it's in the form
// of /keybase/<tlfType>/blah... . It does not try to canonicalize TLF names.
func BuildCanonicalPath(pathType PathType, paths ...string) string {
	var prefix string
	switch pathType {
	case KeybasePathType:
		prefix = "/" + string(KeybasePathType)
	default:
		prefix = "/" + string(KeybasePathType) + "/" + string(pathType)
	}
	pathElements := []string{prefix}
	for _, p := range paths {
		if p != "" {
			pathElements = append(pathElements, p)
		}
	}
	return strings.Join(pathElements, "/")
}

// BuildCanonicalPathForTlfType is like BuildCanonicalPath, but accepts a
// tlf.Type instead of PathType.
func BuildCanonicalPathForTlfType(t tlf.Type, paths ...string) string {
	var pathType PathType
	switch t {
	case tlf.Private:
		pathType = PrivatePathType
	case tlf.Public:
		pathType = PublicPathType
	case tlf.SingleTeam:
		pathType = SingleTeamPathType
	default:
		panic(fmt.Sprintf("Unknown tlf path type: %d", t))
	}

	return BuildCanonicalPath(pathType, paths...)
}

// BuildCanonicalPathForTlfName returns a canonical path for a tlf.
func BuildCanonicalPathForTlfName(t tlf.Type, tlfName tlf.CanonicalName) string {
	return BuildCanonicalPathForTlfType(t, string(tlfName))
}

// BuildCanonicalPathForTlf returns a canonical path for a tlf. Although tlf
// identifies a TLF, paths should still include the TLF name. This function
// does not try to canonicalize TLF names.
func BuildCanonicalPathForTlf(tlf tlf.ID, paths ...string) string {
	return BuildCanonicalPathForTlfType(tlf.Type(), paths...)
}

// BuildProtocolPathForTlfName builds a `keybase1.Path` for the given
// TLF type and name.
func BuildProtocolPathForTlfName(
	t tlf.Type, tlfName tlf.CanonicalName) keybase1.Path {
	var pathType PathType
	switch t {
	case tlf.Private:
		pathType = PrivatePathType
	case tlf.Public:
		pathType = PublicPathType
	case tlf.SingleTeam:
		pathType = SingleTeamPathType
	default:
		panic(fmt.Sprintf("Unknown tlf path type: %d", t))
	}

	return keybase1.NewPathWithKbfs(
		keybase1.KBFSPath{Path: "/" + string(pathType) + "/" + string(tlfName)})
}
