package libkbfs

import (
	"fmt"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

func mdCacheInit(t *testing.T, cap int) (
	mockCtrl *gomock.Controller, config *ConfigMock) {
	ctr := NewSafeTestReporter(t)
	mockCtrl = gomock.NewController(ctr)
	config = NewConfigMock(mockCtrl, ctr)
	mdcache := NewMDCacheStandard(cap)
	config.SetMDCache(mdcache)
	return
}

func mdCacheShutdown(mockCtrl *gomock.Controller, config *ConfigMock) {
	config.ctr.CheckForFailures()
	mockCtrl.Finish()
}

func expectUsernameCall(u keybase1.UID, config *ConfigMock) {
	name := libkb.NewNormalizedUsername(fmt.Sprintf("user_%s", u))
	config.mockKbpki.EXPECT().GetNormalizedUsername(gomock.Any(), u).AnyTimes().
		Return(name, nil)
}

func expectUsernameCalls(handle *TlfHandle, config *ConfigMock) {
	for _, u := range handle.Writers {
		expectUsernameCall(u, config)
	}
	for _, u := range handle.Readers {
		expectUsernameCall(u, config)
	}
}

func testMdcachePut(t *testing.T, tlf TlfID, rev MetadataRevision,
	mStatus MergeStatus, h *TlfHandle, config *ConfigMock) {
	rmd := &RootMetadata{
		ID:       tlf,
		Revision: rev,
		Keys:     make([]TLFKeyBundle, 1, 1),
	}
	k := TLFKeyBundle{}
	rmd.Keys[0] = k
	if mStatus == Unmerged {
		rmd.Flags |= MetadataFlagUnmerged
	}

	// put the md
	expectUsernameCalls(h, config)
	if err := config.MDCache().Put(rmd); err != nil {
		t.Errorf("Got error on put on md %v: %v", tlf, err)
	}

	// make sure we can get it successfully
	if rmd2, err := config.MDCache().Get(tlf, rev, mStatus); err != nil {
		t.Errorf("Got error on get for md %v: %v", tlf, err)
	} else if rmd2 != rmd {
		t.Errorf("Got back unexpected metadata: %v", rmd2)
	}
}

func TestMdcachePut(t *testing.T) {
	mockCtrl, config := mdCacheInit(t, 100)
	defer mdCacheShutdown(mockCtrl, config)

	id, h, _ := newDir(t, config, 1, true, false)
	h.Writers = append(h.Writers, keybase1.MakeTestUID(0))

	testMdcachePut(t, id, 1, Merged, h, config)
}

func TestMdcachePutPastCapacity(t *testing.T) {
	mockCtrl, config := mdCacheInit(t, 2)
	defer mdCacheShutdown(mockCtrl, config)

	id0, h0, _ := newDir(t, config, 1, true, false)
	h0.Writers = append(h0.Writers, keybase1.MakeTestUID(0))

	id1, h1, _ := newDir(t, config, 2, true, false)
	h1.Writers = append(h1.Writers, keybase1.MakeTestUID(1))

	id2, h2, _ := newDir(t, config, 3, true, false)
	h2.Writers = append(h2.Writers, keybase1.MakeTestUID(2))

	testMdcachePut(t, id0, 0, Merged, h0, config)
	testMdcachePut(t, id1, 0, Unmerged, h1, config)
	testMdcachePut(t, id2, 1, Merged, h2, config)

	// id 0 should no longer be in the cache
	// make sure we can get it successfully
	expectUsernameCalls(h0, config)
	expectedErr := NoSuchMDError{id0, 0, Merged}
	if _, err := config.MDCache().Get(id0, 0, Merged); err == nil {
		t.Errorf("No expected error on get")
	} else if err != expectedErr {
		t.Errorf("Got unexpected error on get: %v", err)
	}
}
