// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/dokan"
)

// Mount uses default mount and blocks.
func dokanMount(cfg *dokan.Config, force bool, log logger.Logger) (*dokan.MountHandle, error) {
	var err error
	var h *dokan.MountHandle
	// Retry loop
	for i := 8; true; i *= 2 {
		h, err = dokan.Mount(cfg)
		// break if success, no force or too many tries.
		if err == nil || i > 128 {
			break
		}
		log.Errorf("Failed to mount dokan filesystem (i=%d): %v", i, err)
		// Sleep two times 800ms, 1.6s, 3.2s, ...
		time.Sleep(time.Duration(i) * 100 * time.Millisecond)
		if force {
			dokan.Unmount(cfg.Path)
			time.Sleep(time.Duration(i) * 100 * time.Millisecond)
		}
	}

	return h, err
}
