// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsmd

import "fmt"

// MetadataVer is the type of a version for marshalled KBFS metadata
// structures.
type MetadataVer int

const (
	// FirstValidMetadataVer is the first value that is considered a
	// valid data version. For historical reasons 0 is considered
	// valid.
	FirstValidMetadataVer MetadataVer = 0
	// PreExtraMetadataVer is the latest metadata version that did not include
	// support for extra MD fields.
	PreExtraMetadataVer MetadataVer = 1
	// InitialExtraMetadataVer is the first metadata version that did
	// include support for extra MD fields.
	InitialExtraMetadataVer MetadataVer = 2
	// SegregatedKeyBundlesVer is the first metadata version to allow separate
	// storage of key bundles.
	SegregatedKeyBundlesVer MetadataVer = 3
	// ImplicitTeamsVer is the first metadata version to allow private
	// and public TLFs to be backed by implicit teams (and thus use
	// service-provided encryption keys).  An MD of this version is
	// data-compatible with `SegregatedKeyBundlesVer`, it's just the
	// keys-getting process that's different.  This version bump is
	// more intended to provide older clients with a nice "you need to
	// upgrade" message, rather than to represent any underlying
	// incompatibility.
	ImplicitTeamsVer MetadataVer = 4
)

func (v MetadataVer) String() string {
	switch v {
	case FirstValidMetadataVer:
		return "MDVer(FirstValid)"
	case PreExtraMetadataVer:
		return "MDVer(PreExtra)"
	case InitialExtraMetadataVer:
		return "MDVer(InitialExtra)"
	case SegregatedKeyBundlesVer:
		return "MDVer(SegregatedKeyBundles)"
	case ImplicitTeamsVer:
		return "MDVer(ImplicitTeams)"
	default:
		return fmt.Sprintf("MDVer(%d)", v)
	}
}
