// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libpages

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/ioutil"
	"github.com/keybase/client/go/kbfs/libcontext"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

func populateContent(t *testing.T, config libkbfs.Config) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), config.MDOps(), nil, "bot,user", tlf.Private)
	require.NoError(t, err)
	fs, err := libfs.NewFS(
		ctx, config, h, data.MasterBranch, "", "", keybase1.MDPriorityNormal)
	require.NoError(t, err)
	err = fs.MkdirAll("/dir", 0600)
	require.NoError(t, err)
	err = fs.Symlink("dir", "dir-link")
	require.NoError(t, err)
	f, err := fs.Create("/dir/file")
	require.NoError(t, err)
	_, err = f.Write([]byte("test"))
	require.NoError(t, err)
	err = f.Close()
	require.NoError(t, err)
	err = fs.SyncAll()
	require.NoError(t, err)
}

func makeTestKBFSConfig(t *testing.T) (
	kbfsConfig libkbfs.Config, shutdown func()) {
	// This env is needed for the regression test for HOTPOT-2207.
	oldEnv := os.Getenv(libkbfs.EnvKeybaseTestObfuscateLogsForTest)
	os.Setenv(libkbfs.EnvKeybaseTestObfuscateLogsForTest, "1")

	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	cfg := libkbfs.MakeTestConfigOrBustLoggedInWithMode(
		t, 0, libkbfs.InitSingleOp, "bot", "user")

	populateContent(t, cfg)

	tempdir, err := ioutil.TempDir(os.TempDir(), "journal_server")
	require.NoError(t, err)
	err = cfg.EnableDiskLimiter(tempdir)
	require.NoError(t, err)
	err = cfg.EnableJournaling(
		ctx, tempdir, libkbfs.TLFJournalSingleOpBackgroundWorkEnabled)
	require.NoError(t, err)
	shutdown = func() {
		libkbfs.CheckConfigAndShutdown(ctx, t, cfg)
		os.Setenv(libkbfs.EnvKeybaseTestObfuscateLogsForTest, oldEnv)
		err := ioutil.RemoveAll(tempdir)
		require.NoError(t, err)
	}

	return cfg, shutdown
}

type TestRootLoader map[string]string

func (l TestRootLoader) LoadRoot(domain string) (root Root, err error) {
	str, ok := l[domain]
	if !ok {
		return Root{}, ErrKeybasePagesRecordNotFound{}
	}
	r, err := ParseRoot(str)
	if err != nil {
		return Root{}, err
	}
	return *r, nil
}

func TestServerDefault(t *testing.T) {
	kbfsConfig, shutdown := makeTestKBFSConfig(t)
	defer shutdown()

	logger, err := zap.NewDevelopment()
	require.NoError(t, err)
	server := Server{
		kbfsConfig: kbfsConfig,
		config: &ServerConfig{
			Logger: logger,
		},
		rootLoader: TestRootLoader{
			"example.com": "/keybase/private/user,bot",
		},
	}
	server.siteCache, err = lru.NewWithEvict(fsCacheSize, server.siteCacheEvict)
	require.NoError(t, err)

	w := httptest.NewRecorder()
	server.ServeHTTP(w, httptest.NewRequest("GET", "/", nil))
	require.Equal(t, http.StatusForbidden, w.Code)

	w = httptest.NewRecorder()
	server.ServeHTTP(w, httptest.NewRequest("GET", "/non-existent", nil))
	require.Equal(t, http.StatusNotFound, w.Code)

	// Regression test HOTPOT-2207.
	w = httptest.NewRecorder()
	server.ServeHTTP(w, httptest.NewRequest("GET", "/dir-link/file", nil))
	require.Equal(t, http.StatusOK, w.Code)

	// TODO: if we ever add a test that involves bcrypt, remember to swap
	// DefaultCost out and use MinCost.
}
