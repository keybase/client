// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
)

func testMdcacheMakeHandle(t *testing.T, n uint32) *TlfHandle {
	uid := keybase1.MakeTestUID(n)
	bh, err := tlf.MakeHandle([]keybase1.UID{uid}, nil, nil, nil, nil)
	require.NoError(t, err)

	nug := testNormalizedUsernameGetter{
		uid: libkb.NormalizedUsername(fmt.Sprintf("fake_user_%d", n)),
	}

	ctx := context.Background()
	h, err := MakeTlfHandle(ctx, bh, nug)
	require.NoError(t, err)
	return h
}

func testMdcachePut(t *testing.T, tlfID tlf.ID, rev kbfsmd.Revision,
	bid BranchID, h *TlfHandle, mdcache *MDCacheStandard) {
	rmd, err := makeInitialRootMetadata(defaultClientMetadataVer, tlfID, h)
	require.NoError(t, err)
	rmd.SetRevision(rev)
	if bid != NullBranchID {
		rmd.SetUnmerged()
		rmd.SetBranchID(bid)
	}

	signingKey := kbfscrypto.MakeFakeSigningKeyOrBust("fake signing key")
	err = rmd.bareMd.SignWriterMetadataInternally(context.Background(),
		kbfscodec.NewMsgpack(),
		kbfscrypto.SigningKeySigner{Key: signingKey})
	require.NoError(t, err)

	// put the md
	irmd := MakeImmutableRootMetadata(
		rmd, signingKey.GetVerifyingKey(), kbfsmd.FakeID(1), time.Now())
	if err := mdcache.Put(irmd); err != nil {
		t.Errorf("Got error on put on md %v: %v", tlfID, err)
	}

	// make sure we can get it successfully
	irmd2, err := mdcache.Get(tlfID, rev, bid)
	require.NoError(t, err)
	require.Equal(t, irmd, irmd2)
}

func TestMdcachePut(t *testing.T) {
	tlfID := tlf.FakeID(1, false)
	h := testMdcacheMakeHandle(t, 1)

	mdcache := NewMDCacheStandard(100)
	testMdcachePut(t, tlfID, 1, NullBranchID, h, mdcache)
}

func TestMdcachePutPastCapacity(t *testing.T) {
	id0 := tlf.FakeID(1, false)
	h0 := testMdcacheMakeHandle(t, 0)

	id1 := tlf.FakeID(2, false)
	h1 := testMdcacheMakeHandle(t, 1)

	id2 := tlf.FakeID(3, false)
	h2 := testMdcacheMakeHandle(t, 2)

	mdcache := NewMDCacheStandard(2)
	testMdcachePut(t, id0, 0, NullBranchID, h0, mdcache)
	bid := FakeBranchID(1)
	testMdcachePut(t, id1, 0, bid, h1, mdcache)
	testMdcachePut(t, id2, 1, NullBranchID, h2, mdcache)

	// id 0 should no longer be in the cache
	_, err := mdcache.Get(id0, 0, NullBranchID)
	require.Equal(t, NoSuchMDError{id0, 0, NullBranchID}, err)
}

func TestMdcacheReplace(t *testing.T) {
	id := tlf.FakeID(1, false)
	h := testMdcacheMakeHandle(t, 1)

	mdcache := NewMDCacheStandard(100)
	testMdcachePut(t, id, 1, NullBranchID, h, mdcache)

	irmd, err := mdcache.Get(id, 1, NullBranchID)
	require.NoError(t, err)

	// Change the BID
	bid := FakeBranchID(1)
	newRmd, err := irmd.deepCopy(kbfscodec.NewMsgpack())
	require.NoError(t, err)

	newRmd.SetBranchID(bid)
	err = mdcache.Replace(MakeImmutableRootMetadata(newRmd,
		irmd.LastModifyingWriterVerifyingKey(), kbfsmd.FakeID(2), time.Now()), NullBranchID)
	require.NoError(t, err)

	_, err = mdcache.Get(id, 1, NullBranchID)
	require.IsType(t, NoSuchMDError{}, err)
	_, err = mdcache.Get(id, 1, bid)
	require.NoError(t, err)
}
