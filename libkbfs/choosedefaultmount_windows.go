// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package libkbfs

import (
	"errors"
	"strings"
)

func chooseDefaultMount(dirs []string) (string, error) {
	var dir string
	if len(dirs) == 0 {
		return "K:", errors.New("chooseDefaultMount fails - nothing to choose from")
	}
	for _, dir = range dirs {
		// Try to use a drive at K or later
		if strings.Compare(strings.ToUpper(dir), "K:") >= 0 {
			break
		}
	}
	return dir, nil
}
