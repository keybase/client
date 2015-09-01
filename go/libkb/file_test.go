package libkb

import (
	"os"
	"testing"
)

func TestFileSave(t *testing.T) {
	filename := "file_test.tmp"

	defer os.Remove(filename)

	file := NewFile(filename, []byte("test data"), 0644)
	t.Logf("Saving")
	err := file.Save()
	if err != nil {
		t.Fatal(err)
	}
}
