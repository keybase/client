// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"os"
	"sync"
	"testing"
)

func TestFileSave(t *testing.T) {
	filename := "file_test.tmp"
	defer os.Remove(filename)

	file := NewFile(filename, []byte("test data"), 0644)
	t.Logf("Saving")
	err := file.Save(G.Log)
	if err != nil {
		t.Fatal(err)
	}
}

func TestFileSaveConcurrent(t *testing.T) {
	filename := "file_test.tmp"
	defer os.Remove(filename)

	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			file := NewFile(filename, []byte("test data"), 0644)
			t.Logf("Saving")
			err := file.Save(G.Log)
			if err != nil {
				t.Errorf("save err: %s", err)
			}
			wg.Done()
		}()
	}
	wg.Wait()

	var wg2 sync.WaitGroup
	file := NewFile(filename, []byte("test data"), 0644)
	for i := 0; i < 20; i++ {
		wg2.Add(1)
		go func() {
			err := file.Save(G.Log)
			if err != nil {
				t.Errorf("save err: %s", err)
			}
			wg2.Done()
		}()
	}
	wg2.Wait()
}
