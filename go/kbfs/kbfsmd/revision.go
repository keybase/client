// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsmd

import "strconv"

// Revision is the type for the revision number.
// This is currently int64 since that's the type of Avro's long.
type Revision int64

// String converts a Revision to its string form.
func (mr Revision) String() string {
	return strconv.FormatInt(mr.Number(), 10)
}

// Number casts a Revision to it's primitive type.
func (mr Revision) Number() int64 {
	return int64(mr)
}

const (
	// RevisionUninitialized indicates that a top-level folder has
	// not yet been initialized.
	RevisionUninitialized = Revision(0)
	// RevisionInitial is always the first revision for an
	// initialized top-level folder.
	RevisionInitial = Revision(1)
)
