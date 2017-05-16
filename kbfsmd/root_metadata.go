// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsmd

import "github.com/keybase/kbfs/tlf"

// RootMetadata is a read-only interface to the serializeable MD that
// is signed by the reader or writer.
//
// TODO: Move the rest of libkbfs.BareRootMetadata here.
type RootMetadata interface {
	// TlfID returns the ID of the TLF this BareRootMetadata is for.
	TlfID() tlf.ID
	// GetSerializedPrivateMetadata returns the serialized private metadata as a byte slice.
	GetSerializedPrivateMetadata() []byte
}
