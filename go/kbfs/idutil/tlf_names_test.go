// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package idutil

import (
	"testing"

	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeNamesInTLF(t *testing.T) {
	writerNames := []string{"BB", "C@Twitter", "d@twitter", "aa"}
	readerNames := []string{"EE", "ff", "AA@HackerNews", "aa", "BB", "bb", "ZZ@hackernews"}
	s, changes, err := NormalizeNamesInTLF(
		writerNames, readerNames, tlf.Private, "")
	require.NoError(t, err)
	require.True(t, changes)
	assert.Equal(t, "aa,bb,c@twitter,d@twitter#AA@hackernews,ZZ@hackernews,aa,bb,bb,ee,ff", s)
}

func TestNormalizeNamesInTLFWithConflict(t *testing.T) {
	writerNames := []string{"BB", "C@Twitter", "d@twitter", "aa"}
	readerNames := []string{"EE", "ff", "AA@HackerNews", "aa", "BB", "bb", "ZZ@hackernews"}
	conflictSuffix := "(cOnflictED coPy 2015-05-11 #4)"
	s, changes, err := NormalizeNamesInTLF(
		writerNames, readerNames, tlf.Private, conflictSuffix)
	require.NoError(t, err)
	require.True(t, changes)
	assert.Equal(t, "aa,bb,c@twitter,d@twitter#AA@hackernews,ZZ@hackernews,aa,bb,bb,ee,ff (conflicted copy 2015-05-11 #4)", s)
}
