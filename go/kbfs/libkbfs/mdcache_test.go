// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"fmt"
	"testing"
	"time"

	idutiltest "github.com/keybase/client/go/kbfs/idutil/test"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func testMdcacheMakeHandle(t *testing.T, n uint32) *tlfhandle.Handle {
	id := keybase1.MakeTestUID(n).AsUserOrTeam()
	bh, err := tlf.MakeHandle([]keybase1.UserOrTeamID{id}, nil, nil, nil, nil)
	require.NoError(t, err)

	nug := idutiltest.NormalizedUsernameGetter{
		id: kbname.NormalizedUsername(fmt.Sprintf("fake_user_%d", n)),
	}

	ctx := context.Background()
	h, err := tlfhandle.MakeHandle(
		ctx, bh, bh.Type(), nil, nug, nil, keybase1.OfflineAvailability_NONE)
	require.NoError(t, err)
	return h
}

func testMdcachePut(t *testing.T, tlfID tlf.ID, rev kbfsmd.Revision,
	bid kbfsmd.BranchID, h *tlfhandle.Handle, mdcache *MDCacheStandard) {
	rmd, err := makeInitialRootMetadata(defaultClientMetadataVer, tlfID, h)
	require.NoError(t, err)
	rmd.SetRevision(rev)
	if bid != kbfsmd.NullBranchID {
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
		rmd, signingKey.GetVerifyingKey(), kbfsmd.FakeID(1), time.Now(), true)
	if err := mdcache.Put(irmd); err != nil {
		t.Errorf("Got error on put on md %v: %v", tlfID, err)
	}

	// make sure we can get it successfully
	irmd2, err := mdcache.Get(tlfID, rev, bid)
	require.NoError(t, err)
	require.Equal(t, irmd, irmd2)
}

func TestMdcachePut(t *testing.T) {
	tlfID := tlf.FakeID(1, tlf.Private)
	h := testMdcacheMakeHandle(t, 1)

	mdcache := NewMDCacheStandard(100)
	testMdcachePut(t, tlfID, 1, kbfsmd.NullBranchID, h, mdcache)
}

func TestMdcachePutPastCapacity(t *testing.T) {
	id0 := tlf.FakeID(1, tlf.Private)
	h0 := testMdcacheMakeHandle(t, 0)

	id1 := tlf.FakeID(2, tlf.Private)
	h1 := testMdcacheMakeHandle(t, 1)

	id2 := tlf.FakeID(3, tlf.Private)
	h2 := testMdcacheMakeHandle(t, 2)

	mdcache := NewMDCacheStandard(2)
	testMdcachePut(t, id0, 0, kbfsmd.NullBranchID, h0, mdcache)
	bid := kbfsmd.FakeBranchID(1)
	testMdcachePut(t, id1, 0, bid, h1, mdcache)
	testMdcachePut(t, id2, 1, kbfsmd.NullBranchID, h2, mdcache)

	// id 0 should no longer be in the cache
	_, err := mdcache.Get(id0, 0, kbfsmd.NullBranchID)
	require.Equal(t, NoSuchMDError{id0, 0, kbfsmd.NullBranchID}, err)
}

func TestMdcacheReplace(t *testing.T) {
	id := tlf.FakeID(1, tlf.Private)
	h := testMdcacheMakeHandle(t, 1)

	mdcache := NewMDCacheStandard(100)
	testMdcachePut(t, id, 1, kbfsmd.NullBranchID, h, mdcache)

	irmd, err := mdcache.Get(id, 1, kbfsmd.NullBranchID)
	require.NoError(t, err)

	// Change the BID
	bid := kbfsmd.FakeBranchID(1)
	newRmd, err := irmd.deepCopy(kbfscodec.NewMsgpack())
	require.NoError(t, err)

	newRmd.SetBranchID(bid)
	err = mdcache.Replace(MakeImmutableRootMetadata(newRmd,
		irmd.LastModifyingWriterVerifyingKey(), kbfsmd.FakeID(2), time.Now(),
		true), kbfsmd.NullBranchID)
	require.NoError(t, err)

	_, err = mdcache.Get(id, 1, kbfsmd.NullBranchID)
	require.IsType(t, NoSuchMDError{}, err)
	_, err = mdcache.Get(id, 1, bid)
	require.NoError(t, err)
}
