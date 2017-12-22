// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libpages

import (
	"context"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libpages/config"
)

const configCacheTime = 16 * time.Second

type site struct {
	// fs should never once constructed.
	fs *libfs.FS

	// TODO: replace this with a notification mechanism from the FBO.
	cachedConfigLock      sync.RWMutex
	cachedConfig          config.Config
	cachedConfigExpiresAt time.Time
}

const kbpConfigPath = "/.kbp_config"

func makeSite(fs *libfs.FS) *site {
	return &site{fs: fs}
}

func (s *site) getCachedConfig() (cfg config.Config, expiresAt time.Time) {
	s.cachedConfigLock.RLock()
	defer s.cachedConfigLock.RUnlock()
	return s.cachedConfig, s.cachedConfigExpiresAt
}

func (s *site) fetchConfigAndRefreshCache() (cfg config.Config, err error) {
	// Take the lock early to block other reads, since otherwise they would
	// also reach here, causing unnecessary multiple fetches.
	s.cachedConfigLock.Lock()
	defer s.cachedConfigLock.Unlock()

	f, err := s.fs.Open(kbpConfigPath)
	switch {
	case os.IsNotExist(err):
		cfg = config.DefaultV1()
	case err == nil:
		cfg, err = config.ParseConfig(f)
		if err != nil {
			return nil, err
		}
	default:
		return nil, err
	}

	s.cachedConfig = cfg
	s.cachedConfigExpiresAt = time.Now()

	return cfg, nil
}

func (s *site) getConfig(forceRefresh bool) (cfg config.Config, err error) {
	cachedConfig, cacheExpiresAt := s.getCachedConfig()
	if !forceRefresh && cacheExpiresAt.After(time.Now()) {
		return cachedConfig, nil
	}
	return s.fetchConfigAndRefreshCache()
}

func (s *site) getHTTPFileSystem(ctx context.Context) http.FileSystem {
	return s.fs.ToHTTPFileSystem(ctx)
}
