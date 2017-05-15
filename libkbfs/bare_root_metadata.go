// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/tlf"
)

// TODO: Wrap errors coming from BareRootMetadata.

// MakeInitialBareRootMetadata creates a new MutableBareRootMetadata
// instance of the given MetadataVer with revision
// RevisionInitial, and the given TLF ID and handle. Note that
// if the given ID/handle are private, rekeying must be done
// separately.
func MakeInitialBareRootMetadata(
	ver MetadataVer, tlfID tlf.ID, h tlf.Handle) (
	MutableBareRootMetadata, error) {
	if ver < FirstValidMetadataVer {
		return nil, InvalidMetadataVersionError{tlfID, ver}
	}
	if ver > SegregatedKeyBundlesVer {
		// Shouldn't be possible at the moment.
		panic("Invalid metadata version")
	}
	if ver < SegregatedKeyBundlesVer {
		return MakeInitialBareRootMetadataV2(tlfID, h)
	}

	return MakeInitialBareRootMetadataV3(tlfID, h)
}

func dumpConfig() *spew.ConfigState {
	c := spew.NewDefaultConfig()
	c.Indent = "  "
	c.DisablePointerAddresses = true
	c.DisableCapacities = true
	c.SortKeys = true
	return c
}

// DumpBareRootMetadata returns a detailed dump of the given
// BareRootMetadata's contents.
func DumpBareRootMetadata(
	codec kbfscodec.Codec, brmd BareRootMetadata) (string, error) {
	serializedBRMD, err := codec.Encode(brmd)
	if err != nil {
		return "", err
	}

	// Make a copy so we can zero out SerializedPrivateMetadata.
	brmdCopy, err := brmd.DeepCopy(codec)
	if err != nil {
		return "", err
	}

	switch brmdCopy := brmdCopy.(type) {
	case *BareRootMetadataV2:
		brmdCopy.SerializedPrivateMetadata = nil
	case *BareRootMetadataV3:
		brmdCopy.WriterMetadata.SerializedPrivateMetadata = nil
	default:
		// Do nothing, and let SerializedPrivateMetadata get
		// spewed, I guess.
	}
	s := fmt.Sprintf("MD size: %d bytes\n"+
		"MD version: %s\n\n", len(serializedBRMD), brmd.Version())
	s += dumpConfig().Sdump(brmdCopy)
	return s, nil
}
