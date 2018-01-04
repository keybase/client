// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"os"
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/env"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
)

func TestAutogitNodeWrappers(t *testing.T) {
	ctx, config, cancel, tempdir := initConfigForAutogit(t)
	defer cancel()
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	defer os.RemoveAll(tempdir)

	kbCtx := env.NewContext()
	kbfsInitParams := libkbfs.DefaultInitParams(kbCtx)
	shutdown := startAutogit(kbCtx, config, &kbfsInitParams, 1)
	defer shutdown()

	h, err := libkbfs.ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), "user1", tlf.Private)
	require.NoError(t, err)
	rootFS, err := libfs.NewFS(
		ctx, config, h, "", "", keybase1.MDPriorityNormal)
	require.NoError(t, err)

	t.Log("Looking at user1's autogit directory should succeed, and " +
		"autocreate all the necessary directories")
	fis, err := rootFS.ReadDir(rootFS.Join(autogitRoot, private, "user1"))
	require.NoError(t, err)
	require.Len(t, fis, 0)
	fis, err = rootFS.ReadDir(rootFS.Join(autogitRoot, public, "user1"))
	require.NoError(t, err)
	require.Len(t, fis, 0)

	t.Log("Looking up a non-existent user won't work")
	_, err = rootFS.ReadDir(rootFS.Join(autogitRoot, private, "user2"))
	require.NotNil(t, err)

	t.Log("Looking up the wrong TLF type won't work")
	_, err = rootFS.ReadDir(rootFS.Join(autogitRoot, "faketlftype", "user1"))
	require.NotNil(t, err)

	t.Log("Other autocreates in the root won't work")
	_, err = rootFS.ReadDir("a")
	require.NotNil(t, err)
}
