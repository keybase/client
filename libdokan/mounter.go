// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/dokan"
)

type mounter struct {
	options StartOptions
	c       *dokan.MountHandle
	log     logger.Logger
}

func (m *mounter) Unmount() error { return m.c.Close() }

func (m *mounter) Mount() (err error) {
	// Retry loop
	for i := 8; true; i *= 2 {
		m.c, err = dokan.Mount(&m.options.DokanConfig)
		// break if success, no force or too many tries.
		if err == nil || i > 128 {
			break
		}
		m.log.Errorf("Failed to mount dokan filesystem (i=%d): %v", i, err)
		// Sleep two times 800ms, 1.6s, 3.2s, ...
		time.Sleep(time.Duration(i) * 100 * time.Millisecond)
		if m.options.ForceMount {
			dokan.Unmount(m.options.DokanConfig.Path)
			time.Sleep(time.Duration(i) * 100 * time.Millisecond)
		}
	}
	return err
}
