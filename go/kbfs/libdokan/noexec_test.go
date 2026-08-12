// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

//go:build windows

package libdokan

import (
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/keybase/client/go/kbfs/libcontext"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbun"
	"github.com/stretchr/testify/require"
)

func findGoExe() (string, error) {
	for _, path := range []string{
		"go.exe",
		os.Getenv("GOBIN") + "/go.exe", os.Getenv("GOROOT") + "/bin/go.exe",
	} {
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
	err = tgt.Sync()
	if err != nil {
		return err
	}
	return nil
}

func unames(uns []string) []kbun.NormalizedUsername {
	res := make([]kbun.NormalizedUsername, len(uns))
	for i, v := range uns {
		res[i] = kbun.NormalizedUsername(v)
	}
	return res
}

func testNoExec(t *testing.T, users []string) error {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, unames(users)...)
	// Background flushed needed for large files.
	config.SetDoBackgroundFlushes(true)
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	exe, err := findGoExe()
	require.NoError(t, err, fmt.Sprint("Error finding go.exe: ", err))

	tlfName := strings.Join(users, ",")
	targetPath := filepath.Join(mnt.Dir, PrivateName, tlfName, "test.exe")

	err = copyFile(exe, targetPath)
	require.NoError(t, err, fmt.Sprint("Error copying go.exe to kbfs: ", err))

	return exec.Command(targetPath, "version").Run()
}

func TestNoExec(t *testing.T) {
	err := testNoExec(t, []string{"jdoe", "janedoe"})
	require.Error(t, err,
		"Unexpected success executing go on kbfs, expected fail (noexec)")
	require.True(t, os.IsPermission(err), fmt.Sprint("Wrong error trying to execute go on kbfs: ", err))
}

func TestNoExecWhitelist(t *testing.T) {
	err := testNoExec(t, []string{"jdoe"})
	require.NoError(t, err, fmt.Sprint("Unexpected failure executing go on kbfs, expected success (whitelist): ", err))
}
