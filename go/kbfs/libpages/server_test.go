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
	"github.com/keybase/client/go/kbfs/ioutil"
	"github.com/keybase/client/go/kbfs/libcontext"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

func makeTestKBFSConfig(t *testing.T) (
	kbfsConfig libkbfs.Config, shutdown func()) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	cfg := libkbfs.MakeTestConfigOrBustLoggedInWithMode(
		t, 0, libkbfs.InitSingleOp, "bot", "user")

	tempdir, err := ioutil.TempDir(os.TempDir(), "journal_server")
	require.NoError(t, err)
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

	return cfg, shutdown
}

type TestRootLoader map[string]string

func (l TestRootLoader) LoadRoot(domain string) (root Root, err error) {
	str, ok := l[domain]
	if !ok {
		return Root{}, ErrKeybasePagesRecordNotFound{}
	}
	return ParseRoot(str)
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
	require.Equal(t, http.StatusOK, w.Code)

	w = httptest.NewRecorder()
	server.ServeHTTP(w, httptest.NewRequest("GET", "/non-existent", nil))
	require.Equal(t, http.StatusNotFound, w.Code)

	// TODO: if we ever add a test that involves bcrypt, remember to swap
	// DefaultCost out and use MinCost.
}
