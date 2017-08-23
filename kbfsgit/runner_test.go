// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsgit

import (
	"bytes"
	"io/ioutil"
	"os"
	"testing"

	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
)

func TestCapabilities(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	config := libkbfs.MakeTestConfigOrBust(t, "user1")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	input := bytes.NewBufferString("capabilities\n\n")
	var output bytes.Buffer
	r, err := newRunner(ctx, config, "origin", "keybase://private/user1/test",
		"", input, &output)
	require.NoError(t, err)
	err = r.processCommands(ctx)
	require.NoError(t, err)
	require.Equal(t, "fetch\npush\n\n", output.String())
}

func TestInitRepo(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	config := libkbfs.MakeTestConfigOrBustLoggedInWithMode(
		t, 0, libkbfs.InitSingleOp, "user1")
	tempdir := ""
	defer func() {
		libkbfs.CheckConfigAndShutdown(ctx, t, config)
		if tempdir != "" {
			os.RemoveAll(tempdir)
		}
	}()

	var err error
	tempdir, err = ioutil.TempDir(os.TempDir(), "journal_server")
	require.NoError(t, err)
	err = config.EnableDiskLimiter(tempdir)
	require.NoError(t, err)
	err = config.EnableJournaling(
		ctx, tempdir, libkbfs.TLFJournalBackgroundWorkEnabled)
	require.NoError(t, err)

	input := bytes.NewBufferString("list\n\n")
	var output bytes.Buffer
	r, err := newRunner(ctx, config, "origin", "keybase://private/user1/test",
		"", input, &output)
	require.NoError(t, err)
	err = r.processCommands(ctx)
	require.NoError(t, err)
	// Just one symref, from HEAD to master (and master has no commits yet).
	require.Equal(t, output.String(), "@refs/heads/master HEAD\n\n")

	// Now there should be a valid git repo stored in KBFS.  Check the
	// existence of the HEAD file to be sure.
	h, err := libkbfs.ParseTlfHandle(ctx, config.KBPKI(), "user1", tlf.Private)
	require.NoError(t, err)
	fs, err := libfs.NewFS(ctx, config, h, ".kbfs_git/test", "")
	require.NoError(t, err)
	head, err := fs.Open("HEAD")
	require.NoError(t, err)
	buf, err := ioutil.ReadAll(head)
	require.NoError(t, err)
	require.Equal(t, "ref: refs/heads/master\n", string(buf))
}
