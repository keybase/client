// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package tlfhandle

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestBuildCanonicalPath(t *testing.T) {
	assert.Equal(t, "/keybase/public", BuildCanonicalPath(PublicPathType, ""))
	assert.Equal(t, "/keybase/private", BuildCanonicalPath(PrivatePathType, ""))
	assert.Equal(t, "/keybase/public/u1", BuildCanonicalPath(PublicPathType, "u1"))
	assert.Equal(t, "/keybase/private/u2", BuildCanonicalPath(PrivatePathType, "u2"))
	assert.Equal(t, "/keybase/private/u3", BuildCanonicalPath(PrivatePathType, "", "u3"))
	assert.Equal(t, "/keybase/private/u3", BuildCanonicalPath(PrivatePathType, "u3", ""))
	assert.Equal(t, "/keybase/hi.txt", BuildCanonicalPath(KeybasePathType, "hi.txt"))
}
