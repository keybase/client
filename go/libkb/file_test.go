// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"os"
	"runtime"
	"sync"
	"testing"

	"github.com/keybase/client/go/logger"
	"github.com/stretchr/testify/require"
)

func TestFileSave(t *testing.T) {
	filename := "file_test.tmp"
	defer os.Remove(filename)

	file := NewFile(filename, []byte("test data"), 0o644)
	t.Logf("Saving")
	err := file.Save(logger.NewTestLogger(t))
	require.NoError(t, err)
}

func TestFileSaveConcurrent(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("skip this on windows")
	}
	filename := "file_test.tmp"
	defer os.Remove(filename)

	log := logger.NewTestLogger(t)

	var wg sync.WaitGroup
	for range 20 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			file := NewFile(filename, []byte("test data"), 0o644)
			t.Logf("Saving")
			err := file.Save(log)
			if err != nil {
				t.Errorf("save err: %s", err)
			}
		}()
	}
	wg.Wait()

	var wg2 sync.WaitGroup
	file := NewFile(filename, []byte("test data"), 0o644)
	for range 20 {
		wg2.Add(1)
		go func() {
			defer wg2.Done()
			err := file.Save(log)
			if err != nil {
				t.Errorf("save err: %s", err)
			}
		}()
	}
	wg2.Wait()
}
