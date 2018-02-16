// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !windows

package main

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFirstMount(t *testing.T) {
	tempdir, err := ioutil.TempDir(os.TempDir(), "keybasemounthelper")
	require.NoError(t, err)
	defer func() {
		err := os.RemoveAll(tempdir)
		assert.NoError(t, err)
	}()

	originalTarget := filepath.Join(tempdir, "target")
	err = os.Mkdir(originalTarget, 0700)
	require.NoError(t, err)

	firstMountLink := filepath.Join(tempdir, "mount1")
	err = os.Symlink(originalTarget, firstMountLink)
	require.NoError(t, err)

	userMount1 := filepath.Join(tempdir, "user1")
	err = os.Mkdir(userMount1, 0700)
	require.NoError(t, err)

	t.Log("First attempt should succeed and create the link")
	firstMount, err := checkAndSwitchMount(
		firstMountLink, originalTarget, userMount1)
	require.NoError(t, err)
	require.True(t, firstMount)
	currLink, err := os.Readlink(firstMountLink)
	require.NoError(t, err)
	require.Equal(t, userMount1, currLink)

	t.Log("Second attempt shouldn't succeed; no link created")
	userMount2 := filepath.Join(tempdir, "user2")
	err = os.Mkdir(userMount2, 0700)
	require.NoError(t, err)
	firstMount, err = checkAndSwitchMount(
		firstMountLink, originalTarget, userMount2)
	require.NoError(t, err)
	require.False(t, firstMount)
	currLink, err = os.Readlink(firstMountLink)
	require.NoError(t, err)
	require.Equal(t, userMount1, currLink)
}

func TestFirstMountRace(t *testing.T) {
	tempdir, err := ioutil.TempDir(os.TempDir(), "keybasemounthelper")
	require.NoError(t, err)
	defer func() {
		err := os.RemoveAll(tempdir)
		assert.NoError(t, err)
	}()

	originalTarget := filepath.Join(tempdir, "target")
	err = os.Mkdir(originalTarget, 0700)
	require.NoError(t, err)

	firstMountLink := filepath.Join(tempdir, "mount1")
	err = os.Symlink(originalTarget, firstMountLink)
	require.NoError(t, err)

	userMount1 := filepath.Join(tempdir, "user1")
	err = os.Mkdir(userMount1, 0700)
	require.NoError(t, err)

	userMount2 := filepath.Join(tempdir, "user2")
	err = os.Mkdir(userMount2, 0700)
	require.NoError(t, err)

	fileLock, err := takeLock(firstMountLink)
	require.NoError(t, err)
	defer fileLock.Close()

	t.Log("First user with lock takes the symlink in a goroutine")
	errCh1 := make(chan error, 1)
	go func() {
		err = os.Remove(firstMountLink)
		if err != nil {
			errCh1 <- err
			return
		}
		errCh1 <- os.Symlink(userMount1, firstMountLink)
	}()

	t.Log("Second user without lock has to block, " +
		"then will fail to get the mount")
	firstMountCh := make(chan bool, 1)
	errCh2 := make(chan error, 1)
	go func() {
		firstMount, err := checkAndSwitchMount(
			firstMountLink, originalTarget, userMount2)
		firstMountCh <- firstMount
		errCh2 <- err
	}()

	err = <-errCh1
	require.NoError(t, err)
	// No guarantee that the second user has blocked before we close
	// this file, but if there are bugs this should uncover them
	// eventually after enough runs.
	t.Log("Unlock for the second user")
	err = fileLock.Close()
	require.NoError(t, err)
	err = <-errCh2
	require.NoError(t, err)
	firstMount := <-firstMountCh
	require.False(t, firstMount)

	currLink, err := os.Readlink(firstMountLink)
	require.NoError(t, err)
	require.Equal(t, userMount1, currLink)
}
