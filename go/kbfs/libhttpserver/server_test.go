// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libhttpserver

import (
	"fmt"
	"net/http"
	"os"
	"testing"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/env"
	"github.com/keybase/client/go/kbfs/ioutil"
	"github.com/keybase/client/go/kbfs/libcontext"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/stretchr/testify/require"
)

func makeTestKBFSConfig(t *testing.T) (
	kbfsConfig libkbfs.Config, shutdown func()) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	cfg := libkbfs.MakeTestConfigOrBustLoggedInWithMode(
		t, 0, libkbfs.InitSingleOp, "alice", "bob")

	tempdir, err := ioutil.TempDir(os.TempDir(), "journal_server")
	require.NoError(t, err)
	defer func() {
		if err != nil {
			_ = ioutil.RemoveAll(tempdir)
		}
	}()
	err = cfg.EnableDiskLimiter(tempdir)
	require.NoError(t, err)
	err = cfg.EnableJournaling(
		ctx, tempdir, libkbfs.TLFJournalSingleOpBackgroundWorkEnabled)
	require.NoError(t, err)
	shutdown = func() {
		libkbfs.CheckConfigAndShutdown(ctx, t, cfg)
		err := ioutil.RemoveAll(tempdir)
		require.NoError(t, err)
	}

	h, err := tlfhandle.ParseHandle(
		ctx, cfg.KBPKI(), cfg.MDOps(), cfg, "alice,bob", tlf.Private)
	require.NoError(t, err)

	root, _, err := cfg.KBFSOps().GetOrCreateRootNode(ctx, h, data.MasterBranch)
	require.NoError(t, err)
	_, _, err = cfg.KBFSOps().CreateFile(
		ctx, root, root.ChildName("test.txt"), false, false)
	require.NoError(t, err)

	return cfg, shutdown
}

func TestServerDefault(t *testing.T) {
	kbfsConfig, shutdown := makeTestKBFSConfig(t)
	defer shutdown()

	s, err := New(env.EmptyAppStateUpdater{}, kbfsConfig)
	require.NoError(t, err)

	addr, err := s.Address()
	require.NoError(t, err)

	token, err := s.NewToken()
	require.NoError(t, err)

	resp, err := http.Get(fmt.Sprintf(
		"http://%s/files/private/alice,bob/non-existent", addr))
	require.NoError(t, err)
	require.Equal(t, http.StatusForbidden, resp.StatusCode)

	resp, err = http.Get(fmt.Sprintf(
		"http://%s/files/private/alice,bob/non-existent?token=deadbeaf", addr))
	require.NoError(t, err)
	require.Equal(t, http.StatusForbidden, resp.StatusCode)

	resp, err = http.Get(fmt.Sprintf(
		"http://%s/files/private/alice,bob/non-existent?token=%s", addr, token))
	require.NoError(t, err)
	require.Equal(t, http.StatusNotFound, resp.StatusCode)

	resp, err = http.Get(fmt.Sprintf(
		"http://%s/files/private/alice,bob/test.txt?token=%s", addr, token))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.Contains(t, resp.Header.Get("Content-Type"), "charset=")

	resp, err = http.Get(fmt.Sprintf(
		"http://%s/files/blah/alice,bob/non-existent?token=%s", addr, token))
	require.NoError(t, err)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
}
