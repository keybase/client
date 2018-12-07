// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libpages

import (
	"os"
	"sync"
	"time"

	"github.com/keybase/client/go/kbfs/libpages/config"
	"github.com/keybase/client/go/kbfs/tlf"
)

const configCacheTime = 2 * time.Minute

type site struct {
	// fs should never be changed once it's constructed.
	fs         CacheableFS
	tlfID      tlf.ID
	fsShutdown func()
	root       Root

	// TODO: replace this with a notification mechanism from the FBO.
	cachedConfigLock      sync.RWMutex
	cachedConfig          config.Config
	cachedConfigExpiresAt time.Time
}

func makeSite(fs CacheableFS, tlfID tlf.ID, fsShutdown func(), root Root) *site {
	return &site{
		fs:         fs,
		tlfID:      tlfID,
		fsShutdown: fsShutdown,
		root:       root,
	}
}

func (s *site) shutdown() {
	s.fsShutdown()
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

	if s.cachedConfigExpiresAt.After(time.Now()) {
		// Some other goroutine beat us! The cached config is up-to-date now so
		// just return it.
		return s.cachedConfig, nil
	}

	realFS, err := s.fs.Use()
	if err != nil {
		return nil, err
	}

	f, err := realFS.Open(config.DefaultConfigFilepath)
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
	s.cachedConfigExpiresAt = time.Now().Add(configCacheTime)

	return cfg, nil
}

func (s *site) getConfig(forceRefresh bool) (cfg config.Config, err error) {
	cachedConfig, cacheExpiresAt := s.getCachedConfig()
	if !forceRefresh && cacheExpiresAt.After(time.Now()) {
		return cachedConfig, nil
	}
	return s.fetchConfigAndRefreshCache()
}
