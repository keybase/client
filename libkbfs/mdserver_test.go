package libkbfs

import (
	"errors"
	"fmt"
	"testing"

	"golang.org/x/net/context"
)

// This should pass for both local and remote servers.
func TestMDServerBasics(t *testing.T) {
	// setup
	config := MakeTestConfigOrBust(t, "test_user")
	defer config.MDServer().Shutdown()
	mdServer := config.MDServer()
	ctx := context.Background()
	uid, err := config.KBPKI().GetCurrentUID(ctx)
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
		md.MD.ClearMetadataID()
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

	// (3) push some new unmerged metadata blocks linking to the
	//     middle merged block.
	prevRoot = middleRoot
	for i := MetadataRevision(6); i < 41; i++ {
		_, md := NewFolderWithIDAndWriter(t, id, i, true, false, uid)
		md.MD.SerializedPrivateMetadata = make([]byte, 1)
		md.MD.SerializedPrivateMetadata[0] = 0x1
		md.MD.PrevRoot = prevRoot
		AddNewKeysOrBust(t, &md.MD, keys)
		md.MD.ClearMetadataID()
		if err != nil {
			t.Fatal(err)
		}
		md.MD.Flags |= MetadataFlagUnmerged
		err = mdServer.Put(ctx, md)
		if err != nil {
			t.Fatal(err)
		}
		prevRoot, err = md.MD.MetadataID(config)
		if err != nil {
			t.Fatal(err)
		}
	}

	// (4) check for proper unmerged head
	head, err := mdServer.GetForTLF(ctx, id, Unmerged)
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

	// (5) try to get unmerged range
	rmdses, err := mdServer.GetRange(ctx, id, Unmerged, 1, 100)
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

	// (6) prune unmerged
	err = mdServer.PruneUnmerged(ctx, id)
	if err != nil {
		t.Fatal(err)
	}

	// (7) verify head is pruned
	head, err = mdServer.GetForTLF(ctx, id, Unmerged)
	if err != nil {
		t.Fatal(err)
	}
	if head != nil {
		t.Fatal(errors.New("head found"))
	}

	// (8) verify revision history is pruned
	rmdses, err = mdServer.GetRange(ctx, id, Unmerged, 1, 100)
	if err != nil {
		t.Fatal(err)
	}
	if len(rmdses) != 0 {
		t.Fatal(fmt.Errorf("expected no unmerged history, got: %d", len(rmdses)))
	}

	// (9) check for proper merged head
	head, err = mdServer.GetForTLF(ctx, id, Merged)
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

	// (10) try to get merged range
	rmdses, err = mdServer.GetRange(ctx, id, Merged, 1, 100)
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
