// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"

	"github.com/golang/mock/gomock"
	keybase1 "github.com/keybase/client/go/protocol"
)

func mdCacheInit(t *testing.T, cap int) (
	mockCtrl *gomock.Controller, config *ConfigMock) {
	ctr := NewSafeTestReporter(t)
	mockCtrl = gomock.NewController(ctr)
	config = NewConfigMock(mockCtrl, ctr)
	mdcache := NewMDCacheStandard(cap)
	config.SetMDCache(mdcache)
	interposeDaemonKBPKI(config, "alice", "bob", "charlie")
	return
}

func mdCacheShutdown(mockCtrl *gomock.Controller, config *ConfigMock) {
	config.ctr.CheckForFailures()
	mockCtrl.Finish()
}

func testMdcachePut(t *testing.T, tlf TlfID, rev MetadataRevision,
	mStatus MergeStatus, bid BranchID, h *TlfHandle, config *ConfigMock) {
	rmd := &RootMetadata{
		WriterMetadata: WriterMetadata{
			ID:    tlf,
			WKeys: make(TLFWriterKeyGenerations, 1, 1),
			BID:   bid,
		},
		Revision: rev,
		RKeys:    make(TLFReaderKeyGenerations, 1, 1),
	}
	rmd.WKeys[0] = NewEmptyTLFWriterKeyBundle()
	if mStatus == Unmerged {
		rmd.WFlags |= MetadataFlagUnmerged
	}

	// put the md
	if err := config.MDCache().Put(rmd); err != nil {
		t.Errorf("Got error on put on md %v: %v", tlf, err)
	}

	// make sure we can get it successfully
	if rmd2, err := config.MDCache().Get(tlf, rev, bid); err != nil {
		t.Errorf("Got error on get for md %v: %v", tlf, err)
	} else if rmd2 != rmd {
		t.Errorf("Got back unexpected metadata: %v", rmd2)
	}
}

func TestMdcachePut(t *testing.T) {
	mockCtrl, config := mdCacheInit(t, 100)
	defer mdCacheShutdown(mockCtrl, config)

	id := FakeTlfID(1, false)
	h := parseTlfHandleOrBust(t, config, "alice", false)
	h.resolvedWriters[keybase1.MakeTestUID(0)] = "test_user0"

	testMdcachePut(t, id, 1, Merged, NullBranchID, h, config)
}

func TestMdcachePutPastCapacity(t *testing.T) {
	mockCtrl, config := mdCacheInit(t, 2)
	defer mdCacheShutdown(mockCtrl, config)

	id0 := FakeTlfID(1, false)
	h0 := parseTlfHandleOrBust(t, config, "alice", false)

	id1 := FakeTlfID(2, false)
	h1 := parseTlfHandleOrBust(t, config, "alice,bob", false)

	id2 := FakeTlfID(3, false)
	h2 := parseTlfHandleOrBust(t, config, "alice,charlie", false)

	testMdcachePut(t, id0, 0, Merged, NullBranchID, h0, config)
	bid := FakeBranchID(1)
	testMdcachePut(t, id1, 0, Unmerged, bid, h1, config)
	testMdcachePut(t, id2, 1, Merged, NullBranchID, h2, config)

	// id 0 should no longer be in the cache
	// make sure we can get it successfully
	expectedErr := NoSuchMDError{id0, 0, NullBranchID}
	if _, err := config.MDCache().Get(id0, 0, NullBranchID); err == nil {
		t.Errorf("No expected error on get")
	} else if err != expectedErr {
		t.Errorf("Got unexpected error on get: %v", err)
	}
}
