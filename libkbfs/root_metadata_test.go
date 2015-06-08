package libkbfs

import "testing"

// Test that GetDirHandle() generates a DirHandle properly if there is
// no cached DirHandle.
func TestRootMetadataGetDirHandle(t *testing.T) {
	rmd := NewRootMetadata(nil, DirID{})
	rmd.AddNewKeys(DirKeyBundle{})
	dirHandle := rmd.GetDirHandle()
	if dirHandle == nil {
		t.Fatal("nil DirHandle")
	}
}
