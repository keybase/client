// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsmd

import (
	"testing"

	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func getKeyBundlesForTesting(
	t *testing.T, tlfByte byte, h tlf.Handle) (
	TLFWriterKeyBundleID, *TLFWriterKeyBundleV3,
	TLFReaderKeyBundleID, *TLFReaderKeyBundleV3) {
	tlfID := tlf.FakeID(tlfByte, tlf.Private)
	rmd, err := MakeInitialRootMetadataV3(tlfID, h)
	require.NoError(t, err)
	extra := FakeInitialRekey(rmd, h, kbfscrypto.TLFPublicKey{})
	wkbID := rmd.GetTLFWriterKeyBundleID()
	rkbID := rmd.GetTLFReaderKeyBundleID()
	wkb, rkb, err := rmd.GetTLFKeyBundlesForTest(extra)
	require.NoError(t, err)
	return wkbID, wkb, rkbID, rkb
}

func TestKeyBundleCacheBasic(t *testing.T) {
	alice := keybase1.MakeTestUID(1).AsUserOrTeam()
	bob := keybase1.MakeTestUID(2).AsUserOrTeam()
	charlie := keybase1.MakeTestUID(3).AsUserOrTeam()

	h1, err := tlf.MakeHandle([]keybase1.UserOrTeamID{alice, bob}, []keybase1.UserOrTeamID{charlie}, nil, nil, nil)
	require.NoError(t, err)
	h2, err := tlf.MakeHandle([]keybase1.UserOrTeamID{bob, charlie}, []keybase1.UserOrTeamID{alice}, nil, nil, nil)
	require.NoError(t, err)
	h3, err := tlf.MakeHandle([]keybase1.UserOrTeamID{alice, charlie}, []keybase1.UserOrTeamID{bob}, nil, nil, nil)
	require.NoError(t, err)

	wkbID, wkb, rkbID, rkb := getKeyBundlesForTesting(t, 1, h1)
	wkbID2, wkb2, rkbID2, rkb2 := getKeyBundlesForTesting(t, 2, h2)
	wkbID3, wkb3, rkbID3, rkb3 := getKeyBundlesForTesting(t, 3, h3)

	wkbEntrySize := len(wkbID.String()) + wkb.Size()
	rkbEntrySize := len(rkbID.String()) + rkb.Size()
	// Assuming all are the same size (or slightly smaller)
	cache := NewKeyBundleCacheLRU(2*wkbEntrySize + 2*rkbEntrySize)

	checkWkb, err := cache.GetTLFWriterKeyBundle(wkbID)
	require.NoError(t, err)
	require.Nil(t, checkWkb)
	checkWkb, err = cache.GetTLFWriterKeyBundle(wkbID2)
	require.NoError(t, err)
	require.Nil(t, checkWkb)
	checkWkb, err = cache.GetTLFWriterKeyBundle(wkbID3)
	require.NoError(t, err)
	require.Nil(t, checkWkb)

	cache.PutTLFWriterKeyBundle(wkbID, *wkb)
	// add the same bundle twice
	cache.PutTLFWriterKeyBundle(wkbID, *wkb)
	cache.PutTLFWriterKeyBundle(wkbID2, *wkb2)

	checkRkb, err := cache.GetTLFReaderKeyBundle(rkbID)
	require.NoError(t, err)
	require.Nil(t, checkRkb)
	checkRkb, err = cache.GetTLFReaderKeyBundle(rkbID2)
	require.NoError(t, err)
	require.Nil(t, checkRkb)
	checkRkb, err = cache.GetTLFReaderKeyBundle(rkbID3)
	require.NoError(t, err)
	require.Nil(t, checkRkb)

	cache.PutTLFReaderKeyBundle(rkbID, *rkb)
	// add the same bundle twice
	cache.PutTLFReaderKeyBundle(rkbID, *rkb)
	cache.PutTLFReaderKeyBundle(rkbID2, *rkb2)

	checkWkb, err = cache.GetTLFWriterKeyBundle(wkbID)
	require.NoError(t, err)
	require.NotNil(t, checkWkb)
	require.Equal(t, checkWkb, wkb)

	checkWkb, err = cache.GetTLFWriterKeyBundle(wkbID2)
	require.NoError(t, err)
	require.NotNil(t, checkWkb)
	require.Equal(t, checkWkb, wkb2)

	checkWkb, err = cache.GetTLFWriterKeyBundle(wkbID3)
	require.NoError(t, err)
	require.Nil(t, checkWkb)

	checkRkb, err = cache.GetTLFReaderKeyBundle(rkbID)
	require.NoError(t, err)
	require.NotNil(t, checkRkb)
	require.Equal(t, checkRkb, rkb)

	checkRkb, err = cache.GetTLFReaderKeyBundle(rkbID2)
	require.NoError(t, err)
	require.NotNil(t, checkRkb)
	require.Equal(t, checkRkb, rkb2)

	checkRkb, err = cache.GetTLFReaderKeyBundle(rkbID3)
	require.NoError(t, err)
	require.Nil(t, checkRkb)

	cache.PutTLFReaderKeyBundle(rkbID3, *rkb3)
	cache.PutTLFWriterKeyBundle(wkbID3, *wkb3)

	checkWkb, err = cache.GetTLFWriterKeyBundle(wkbID)
	require.NoError(t, err)
	require.Nil(t, checkWkb)
	checkWkb, err = cache.GetTLFWriterKeyBundle(wkbID2)
	require.NoError(t, err)
	require.Nil(t, checkWkb)
	checkWkb, err = cache.GetTLFWriterKeyBundle(wkbID3)
	require.NoError(t, err)
	require.NotNil(t, checkWkb)
	require.Equal(t, checkWkb, wkb3)

	checkRkb, err = cache.GetTLFReaderKeyBundle(rkbID)
	require.NoError(t, err)
	require.NotNil(t, checkRkb)
	require.Equal(t, checkRkb, rkb)

	checkRkb, err = cache.GetTLFReaderKeyBundle(rkbID2)
	require.NoError(t, err)
	require.NotNil(t, checkRkb)
	require.Equal(t, checkRkb, rkb2)

	checkRkb, err = cache.GetTLFReaderKeyBundle(rkbID3)
	require.NoError(t, err)
	require.NotNil(t, checkRkb)
	require.Equal(t, checkRkb, rkb3)
}
