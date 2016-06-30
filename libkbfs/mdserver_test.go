// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"testing"

	"github.com/keybase/client/go/protocol"

	"golang.org/x/net/context"
)

// This should pass for both local and remote servers.
func TestMDServerBasics(t *testing.T) {
	// setup
	config := MakeTestConfigOrBust(t, "test_user")
	defer config.Shutdown()
	mdServer := config.MDServer()
	ctx := context.Background()

	_, uid, err := config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		t.Fatal(err)
	}

	// (1) get metadata -- allocates an ID
	h, err := MakeBareTlfHandle([]keybase1.UID{uid}, nil, nil, nil, nil)
	if err != nil {
		t.Fatal(err)
	}

	id, rmds, err := mdServer.GetForHandle(ctx, h, Merged)
	if err != nil {
		t.Fatal(err)
	}
	if rmds != nil {
		t.Fatal(errors.New("unexpected metadata found"))
	}

	// (2) push some new metadata blocks
	prevRoot := MdID{}
	middleRoot := MdID{}
	for i := MetadataRevision(1); i <= 10; i++ {
		rmds, err := NewRootMetadataSignedForTest(id, h)
		if err != nil {
			t.Fatal(err)
		}
		rmds.MD.SerializedPrivateMetadata = make([]byte, 1)
		rmds.MD.SerializedPrivateMetadata[0] = 0x1
		rmds.MD.Revision = MetadataRevision(i)
		FakeInitialRekey(&rmds.MD, h)
		rmds.MD.clearCachedMetadataIDForTest()
		if i > 1 {
			rmds.MD.PrevRoot = prevRoot
		}
		if err != nil {
			t.Fatal(err)
		}
		err = mdServer.Put(ctx, rmds)
		if err != nil {
			t.Fatal(err)
		}
		prevRoot, err = rmds.MD.MetadataID(config)
		if err != nil {
			t.Fatal(err)
		}
		if i == 5 {
			middleRoot = prevRoot
		}
	}

	// (3) trigger a conflict
	rmds, err = NewRootMetadataSignedForTest(id, h)
	if err != nil {
		t.Fatal(err)
	}
	rmds.MD.Revision = MetadataRevision(10)
	rmds.MD.SerializedPrivateMetadata = make([]byte, 1)
	rmds.MD.SerializedPrivateMetadata[0] = 0x1
	FakeInitialRekey(&rmds.MD, h)
	rmds.MD.PrevRoot = prevRoot
	err = mdServer.Put(ctx, rmds)
	if _, ok := err.(MDServerErrorConflictRevision); !ok {
		t.Fatal(fmt.Errorf("Expected MDServerErrorConflictRevision got: %v", err))
	}

	// (4) push some new unmerged metadata blocks linking to the
	//     middle merged block.
	prevRoot = middleRoot
	bid, err := config.Crypto().MakeRandomBranchID()
	if err != nil {
		t.Fatal(err)
	}
	for i := MetadataRevision(6); i < 41; i++ {
		rmds, err := NewRootMetadataSignedForTest(id, h)
		if err != nil {
			t.Fatal(err)
		}
		rmds.MD.Revision = MetadataRevision(i)
		rmds.MD.SerializedPrivateMetadata = make([]byte, 1)
		rmds.MD.SerializedPrivateMetadata[0] = 0x1
		rmds.MD.PrevRoot = prevRoot
		FakeInitialRekey(&rmds.MD, h)
		rmds.MD.clearCachedMetadataIDForTest()
		rmds.MD.WFlags |= MetadataFlagUnmerged
		rmds.MD.BID = bid
		err = mdServer.Put(ctx, rmds)
		if err != nil {
			t.Fatal(err)
		}
		prevRoot, err = rmds.MD.MetadataID(config)
		if err != nil {
			t.Fatal(err)
		}
	}

	// (5) check for proper unmerged head
	head, err := mdServer.GetForTLF(ctx, id, bid, Unmerged)
	if err != nil {
		t.Fatal(err)
	}
	if head == nil {
		t.Fatal(errors.New("no head found"))
	}
	if head.MD.Revision != MetadataRevision(40) {
		t.Fatal(fmt.Errorf("expected revision 40, got: %d",
			head.MD.Revision))
	}

	// (6a) try to get unmerged range
	rmdses, err := mdServer.GetRange(ctx, id, bid, Unmerged, 1, 100)
	if err != nil {
		t.Fatal(err)
	}
	if len(rmdses) != 35 {
		t.Fatal(fmt.Errorf("expected 35 MD blocks, got: %d", len(rmdses)))
	}
	for i := MetadataRevision(6); i < 16; i++ {
		if rmdses[i-6].MD.Revision != i {
			t.Fatal(fmt.Errorf("expected revision %d, got: %d",
				i, rmdses[i-6].MD.Revision))
		}
	}

	// (6b) try to get unmerged range subset.
	rmdses, err = mdServer.GetRange(ctx, id, bid, Unmerged, 7, 14)
	if err != nil {
		t.Fatal(err)
	}
	if len(rmdses) != 8 {
		t.Fatal(fmt.Errorf("expected 8 MD blocks, got: %d", len(rmdses)))
	}
	for i := MetadataRevision(7); i <= 14; i++ {
		if rmdses[i-7].MD.Revision != i {
			t.Fatal(fmt.Errorf("expected revision %d, got: %d",
				i, rmdses[i-7].MD.Revision))
		}
	}

	// (7) prune unmerged
	err = mdServer.PruneBranch(ctx, id, bid)
	if err != nil {
		t.Fatal(err)
	}

	// (8) verify head is pruned
	head, err = mdServer.GetForTLF(ctx, id, NullBranchID, Unmerged)
	if err != nil {
		t.Fatal(err)
	}
	if head != nil {
		t.Fatal(errors.New("head found"))
	}

	// (9) verify revision history is pruned
	rmdses, err = mdServer.GetRange(ctx, id, NullBranchID, Unmerged, 1, 100)
	if err != nil {
		t.Fatal(err)
	}
	if len(rmdses) != 0 {
		t.Fatal(fmt.Errorf("expected no unmerged history, got: %d", len(rmdses)))
	}

	// (10) check for proper merged head
	head, err = mdServer.GetForTLF(ctx, id, NullBranchID, Merged)
	if err != nil {
		t.Fatal(err)
	}
	if head == nil {
		t.Fatal(errors.New("no head found"))
	}
	if head.MD.Revision != MetadataRevision(10) {
		t.Fatal(fmt.Errorf("expected revision 10, got: %d",
			head.MD.Revision))
	}

	// (11) try to get merged range
	rmdses, err = mdServer.GetRange(ctx, id, NullBranchID, Merged, 1, 100)
	if err != nil {
		t.Fatal(err)
	}
	if len(rmdses) != 10 {
		t.Fatal(fmt.Errorf("expected 10 MD blocks, got: %d", len(rmdses)))
	}
	for i := MetadataRevision(1); i <= 10; i++ {
		if rmdses[i-1].MD.Revision != i {
			t.Fatal(fmt.Errorf("expected revision %d, got: %d",
				i, rmdses[i-1].MD.Revision))
		}
	}
}

// This should pass for both local and remote servers. Make sure that
// registering multiple TLFs for updates works. This is a regression
// test for https://keybase.atlassian.net/browse/KBFS-467 .
func TestMDServerRegisterForUpdate(t *testing.T) {
	// setup
	config := MakeTestConfigOrBust(t, "test_user")
	defer config.Shutdown()
	mdServer := config.MDServer()
	ctx := context.Background()

	_, uid, err := config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		t.Fatal(err)
	}

	// Create first TLF.
	h1, err := MakeBareTlfHandle([]keybase1.UID{uid}, nil, nil, nil, nil)
	if err != nil {
		t.Fatal(err)
	}

	id1, _, err := mdServer.GetForHandle(ctx, h1, Merged)
	if err != nil {
		t.Fatal(err)
	}

	// Create second TLF, which should end up being different from
	// the first one.
	h2, err := MakeBareTlfHandle([]keybase1.UID{uid}, []keybase1.UID{keybase1.PUBLIC_UID}, nil, nil, nil)
	if err != nil {
		t.Fatal(err)
	}

	id2, _, err := mdServer.GetForHandle(ctx, h2, Merged)
	if err != nil {
		t.Fatal(err)
	}
	if id1 == id2 {
		t.Fatalf("id2 == id1: %s", id1)
	}

	_, err = mdServer.RegisterForUpdate(ctx, id1, MetadataRevisionInitial)
	if err != nil {
		t.Fatal(err)
	}

	_, err = mdServer.RegisterForUpdate(ctx, id2, MetadataRevisionInitial)
	if err != nil {
		t.Fatal(err)
	}
}
