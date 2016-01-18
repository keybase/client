package libkbfs

import (
	"testing"

	"github.com/keybase/client/go/protocol"
)

// Test that GetTlfHandle() generates a TlfHandle properly for public
// TLFs if there is no cached TlfHandle.
func TestRootMetadataGetTlfHandlePublic(t *testing.T) {
	tlfID := FakeTlfID(0, true)
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
	tlfID := FakeTlfID(0, false)
	rmd := NewRootMetadata(nil, tlfID)
	AddNewKeysOrBust(t, rmd, *NewTLFKeyBundle())
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

// Test that key generations work as expected for private TLFs.
func TestRootMetadataLatestKeyGenerationPrivate(t *testing.T) {
	tlfID := FakeTlfID(0, false)
	rmd := NewRootMetadata(nil, tlfID)
	if rmd.LatestKeyGeneration() != 0 {
		t.Errorf("Expected key generation to be invalid (0)")
	}
	AddNewKeysOrBust(t, rmd, *NewTLFKeyBundle())
	if rmd.LatestKeyGeneration() != FirstValidKeyGen {
		t.Errorf("Expected key generation to be valid(%d)", FirstValidKeyGen)
	}
}

// Test that key generations work as expected for public TLFs.
func TestRootMetadataLatestKeyGenerationPublic(t *testing.T) {
	tlfID := FakeTlfID(0, true)
	rmd := NewRootMetadata(nil, tlfID)
	if rmd.LatestKeyGeneration() != PublicKeyGen {
		t.Errorf("Expected key generation to be public (%d)", PublicKeyGen)
	}
}
