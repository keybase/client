// +build darwin,!ios

package kext

import (
	"testing"
	"fmt"
)

func TestInfoRaw(t *testing.T) {
	for i := 0; i < 10000; i ++ {
		fmt.Printf("%d....\n", i)
		info, err := LoadInfoRaw("com.github.kbfuse.filesystems.kbfuse")
		if err != nil {
			t.Fatal(err)
		}
		t.Logf("%v", info)
	}
}

func TestInfo(t *testing.T) {
	info, err := LoadInfo("com.github.kbfuse.filesystems.kbfuse")
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("%v", info)
}

func TestInfoNotFound(t *testing.T) {
	info, err := LoadInfo("not.a.kext")
	if err != nil {
		t.Fatal(err)
	}
	if info != nil {
		t.Fatalf("Should have returned nil")
	}
}

/*
func TestLoad(t *testing.T) {
	err := Load("com.github.osxfuse.filesystems.osxfusefs", []string{"/Library/Filesystems/osxfusefs.fs/Support/osxfusefs.kext"})
	if err != nil {
		t.Fatal(err)
	}
}

func TestUnload(t *testing.T) {
	err := Unload("com.github.osxfuse.filesystems.osxfusefs")
	if err != nil {
		t.Fatal(err)
	}
}
*/
