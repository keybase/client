// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package libkbfs

import (
	"github.com/keybase/client/go/logger"
	"golang.org/x/net/context"
	"strings"
)

func chooseDefaultMount(ctx context.Context, dirs []string, log logger.Logger) (string, error) {
	if len(dirs) == 0 {
		log.CInfof(ctx, "chooseDefaultMount fails - nothing to choose from")
		return "K:", nil
	}
	var dir string
	for _, dir = range dirs {
		// Try to use a drive at K or later
		if strings.ToUpper(dir) >= "K:" {
			break
		}
	}
	return dir, nil
}
