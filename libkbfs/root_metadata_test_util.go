// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"time"

	"github.com/keybase/kbfs/kbfscodec"
)

// This file contains test functions related to RootMetadata that need
// to be exported for use by other modules' tests.

// NewRootMetadataSignedForTest returns a new RootMetadataSigned
// object at the latest known version for testing.
func NewRootMetadataSignedForTest(
	id TlfID, h BareTlfHandle, codec kbfscodec.Codec,
	signer cryptoSigner) (*RootMetadataSigned, error) {
	var md BareRootMetadataV2
	// MDv3 TODO: uncomment the below when we're ready for MDv3
	// var md BareRootMetadataV3
	err := md.Update(id, h)
	if err != nil {
		return nil, err
	}

	ctx := context.Background()

	// Encode and sign writer metadata.
	err = md.SignWriterMetadataInternally(ctx, codec, signer)
	if err != nil {
		return nil, err
	}

	rmds, err := signMD(ctx, codec, signer, &md, time.Time{})
	if err != nil {
		return nil, err
	}

	return rmds, nil
}
