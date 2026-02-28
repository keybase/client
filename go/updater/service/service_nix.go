//go:build !windows
// +build !windows

package main

import (
	"io"
	"path/filepath"

	"github.com/keybase/client/go/updater/keybase"
)

func (s *service) lockPID() (io.Closer, error) {
	cacheDir, err := keybase.CacheDir(s.appName)
	if err != nil {
		return nil, err
	}
	lockPID := NewLockPIDFile(filepath.Join(cacheDir, "updater.pid"), s.log)
	if err := lockPID.Lock(); err != nil {
		return nil, err
	}
	s.log.Debug("update pid file %s created, updater service starting", lockPID.name)
	return lockPID, nil
}
