// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

// This file contains test functions related to RootMetadata that need
// to be exported for use by other modules' tests.

// NewRootMetadataSignedForTest returns a new RootMetadataSigned for testing.
func NewRootMetadataSignedForTest(id TlfID, h BareTlfHandle) (*RootMetadataSigned, error) {
	rmds := NewRootMetadataSigned()
	err := rmds.MD.Update(id, h)
	if err != nil {
		return nil, err
	}
	return rmds, nil
}
