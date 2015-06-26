package libkbfs

import (
	"testing"

	"github.com/keybase/client/protocol/go"
)

func addNewKeysOrBust(t *testing.T, rmd *RootMetadata, dkb DirKeyBundle) {
	if err := rmd.AddNewKeys(dkb); err != nil {
		t.Fatal(err)
	}
}

// Test that GetDirHandle() generates a DirHandle properly for public
// TLFs if there is no cached DirHandle.
func TestRootMetadataGetDirHandlePublic(t *testing.T) {
	var tlfID DirID
	tlfID[len(tlfID)-1] = PubDirIDSuffix
	rmd := NewRootMetadata(nil, tlfID)
	dirHandle := rmd.GetDirHandle()
	if dirHandle == nil {
		t.Fatal("nil DirHandle")
	}
	if len(dirHandle.Readers) != 1 || dirHandle.Readers[0] != keybase1.PublicUID {
		t.Errorf("Invalid reader list %v", dirHandle.Readers)
	}
	if len(dirHandle.Writers) != 0 {
		t.Errorf("Invalid writer list %v", dirHandle.Writers)
	}
}

// Test that GetDirHandle() generates a DirHandle properly for
// non-public TLFs if there is no cached DirHandle.
func TestRootMetadataGetDirHandlePrivate(t *testing.T) {
	var tlfID DirID
	tlfID[len(tlfID)-1] = DirIDSuffix
	rmd := NewRootMetadata(nil, tlfID)
	addNewKeysOrBust(t, rmd, DirKeyBundle{})
	dirHandle := rmd.GetDirHandle()
	if dirHandle == nil {
		t.Fatal("nil DirHandle")
	}
	if len(dirHandle.Readers) != 0 {
		t.Errorf("Invalid reader list %v", dirHandle.Readers)
	}
	if len(dirHandle.Writers) != 0 {
		t.Errorf("Invalid writer list %v", dirHandle.Writers)
	}
}
