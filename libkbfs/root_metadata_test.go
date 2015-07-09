package libkbfs

import (
	"testing"

	"github.com/keybase/client/protocol/go"
)

// Test that GetTlfHandle() generates a TlfHandle properly for public
// TLFs if there is no cached TlfHandle.
func TestRootMetadataGetTlfHandlePublic(t *testing.T) {
	var tlfID TlfID
	tlfID[len(tlfID)-1] = PubTlfIDSuffix
	rmd := NewRootMetadata(nil, tlfID)
	dirHandle := rmd.GetTlfHandle()
	if dirHandle == nil {
		t.Fatal("nil TlfHandle")
	}
	if len(dirHandle.Readers) != 1 || dirHandle.Readers[0] != keybase1.PublicUID {
		t.Errorf("Invalid reader list %v", dirHandle.Readers)
	}
	if len(dirHandle.Writers) != 0 {
		t.Errorf("Invalid writer list %v", dirHandle.Writers)
	}
}

// Test that GetTlfHandle() generates a TlfHandle properly for
// non-public TLFs if there is no cached TlfHandle.
func TestRootMetadataGetTlfHandlePrivate(t *testing.T) {
	var tlfID TlfID
	tlfID[len(tlfID)-1] = TlfIDSuffix
	rmd := NewRootMetadata(nil, tlfID)
	AddNewKeysOrBust(t, rmd, DirKeyBundle{})
	dirHandle := rmd.GetTlfHandle()
	if dirHandle == nil {
		t.Fatal("nil TlfHandle")
	}
	if len(dirHandle.Readers) != 0 {
		t.Errorf("Invalid reader list %v", dirHandle.Readers)
	}
	if len(dirHandle.Writers) != 0 {
		t.Errorf("Invalid writer list %v", dirHandle.Writers)
	}
}
