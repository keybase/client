// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"

	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func getKeyBundlesForTesting(
	t *testing.T, c Config, tlfByte byte, handleStr string) (
	TLFWriterKeyBundleID, *TLFWriterKeyBundleV3,
	TLFReaderKeyBundleID, *TLFReaderKeyBundleV3) {
	tlfID := tlf.FakeID(tlfByte, tlf.Private)
	h := parseTlfHandleOrBust(t, c, handleStr, tlf.Private)
	rmd, err := makeInitialRootMetadata(SegregatedKeyBundlesVer, tlfID, h)
	require.NoError(t, err)
	rmd.fakeInitialRekey()
	wkbID := rmd.bareMd.GetTLFWriterKeyBundleID()
	rkbID := rmd.bareMd.GetTLFReaderKeyBundleID()
	wkb, rkb, err := rmd.bareMd.(*BareRootMetadataV3).getTLFKeyBundles(
		rmd.extra)
	require.NoError(t, err)
	return wkbID, wkb, rkbID, rkb
}

func TestKeyBundleCacheBasic(t *testing.T) {
	ctx := context.Background()
	config := MakeTestConfigOrBust(t, "alice", "bob", "charlie")
	defer config.Shutdown(ctx)

	wkbID, wkb, rkbID, rkb := getKeyBundlesForTesting(t,
		config, 1, "alice,bob#charlie")
	wkbID2, wkb2, rkbID2, rkb2 := getKeyBundlesForTesting(t,
		config, 2, "bob,charlie#alice")
	wkbID3, wkb3, rkbID3, rkb3 := getKeyBundlesForTesting(t,
		config, 3, "alice,charlie#bob")

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
