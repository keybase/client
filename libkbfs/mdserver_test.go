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
	var key CryptPublicKey
	key, err = config.KBPKI().GetCurrentCryptPublicKey(ctx)
	if err != nil {
		t.Fatal(err)
	}
	keys := MakeDirWKeyBundle(uid, key)

	// (1) get metadata -- allocates an ID
	handle, _ := NewFolderWithIDAndWriter(t, NullTlfID, 1, true, false, uid)
	id, md, err := mdServer.GetForHandle(ctx, handle, Merged)
	if err != nil {
		t.Fatal(err)
	}
	if md != nil {
		t.Fatal(errors.New("unexpected metadata found"))
	}

	// (2) push some new metadata blocks
	prevRoot := MdID{}
	middleRoot := MdID{}
	for i := MetadataRevision(1); i <= 10; i++ {
		_, md := NewFolderWithIDAndWriter(t, id, i, true, false, uid)
		md.MD.SerializedPrivateMetadata = make([]byte, 1)
		md.MD.SerializedPrivateMetadata[0] = 0x1
		AddNewKeysOrBust(t, &md.MD, keys)
		md.MD.clearCachedMetadataIDForTest()
		if i > 1 {
			md.MD.PrevRoot = prevRoot
		}
		if err != nil {
			t.Fatal(err)
		}
		err = mdServer.Put(ctx, md)
		if err != nil {
			t.Fatal(err)
		}
		prevRoot, err = md.MD.MetadataID(config)
		if err != nil {
			t.Fatal(err)
		}
		if i == 5 {
			middleRoot = prevRoot
		}
	}

	// (3) trigger a conflict
	_, md = NewFolderWithIDAndWriter(t, id, 10, true, false, uid)
	md.MD.SerializedPrivateMetadata = make([]byte, 1)
	md.MD.SerializedPrivateMetadata[0] = 0x1
	AddNewKeysOrBust(t, &md.MD, keys)
	md.MD.PrevRoot = prevRoot
	err = mdServer.Put(ctx, md)
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
		_, md := NewFolderWithIDAndWriter(t, id, i, true, false, uid)
		md.MD.SerializedPrivateMetadata = make([]byte, 1)
		md.MD.SerializedPrivateMetadata[0] = 0x1
		md.MD.PrevRoot = prevRoot
		AddNewKeysOrBust(t, &md.MD, keys)
		md.MD.clearCachedMetadataIDForTest()
		md.MD.WFlags |= MetadataFlagUnmerged
		md.MD.BID = bid
		err = mdServer.Put(ctx, md)
		if err != nil {
			t.Fatal(err)
		}
		prevRoot, err = md.MD.MetadataID(config)
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

	// (6) try to get unmerged range
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
	h1 := NewTlfHandle()
	h1.Writers = []keybase1.UID{uid}
	id1, _, err := mdServer.GetForHandle(ctx, h1, Merged)
	if err != nil {
		t.Fatal(err)
	}

	// Create second TLF, which should end up being different from
	// the first one.
	h2 := NewTlfHandle()
	h2.Readers = []keybase1.UID{keybase1.PublicUID}
	h2.Writers = []keybase1.UID{uid}
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
