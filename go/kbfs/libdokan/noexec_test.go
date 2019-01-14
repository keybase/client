// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package libdokan

import (
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/keybase/client/go/kbfs/libkbfs"
)

func findGoExe() (string, error) {
	for _, path := range []string{"go.exe",
		os.Getenv("GOBIN") + "/go.exe", os.Getenv("GOROOT") + "/bin/go.exe"} {
		exe, err := exec.LookPath(path)
		if err == nil {
			return exe, err
		}

	}
	return "", errors.New("Cannot find go.exe")
}

func copyFile(from, to string) error {
	src, err := Open(from)
	if err != nil {
		return err
	}
	defer src.Close()
	tgt, err := Create(to)
	if err != nil {
		return err
	}
	defer tgt.Close()
	_, err = io.Copy(tgt, src)
	if err != nil {
		return err
	}
	return nil
}

func TestNoExec(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	exe, err := findGoExe()
	if err != nil {
		t.Fatal("Error finding go.exe: ", err)
	}

	targetPath := filepath.Join(mnt.Dir, PrivateName, "jdoe", "test.exe")

	err = copyFile(exe, targetPath)
	if err != nil {
		t.Fatal("Error copying go.exe to kbfs: ", err)
	}

	err = exec.Command(targetPath, "version").Run()
	if err == nil {
		t.Fatal("Unexpected success executing go on kbfs, expected fail (noexec)")
	}
	if !os.IsPermission(err) {
		t.Fatal("Wrong error trying to execute go on kbfs: ", err)
	}

}
