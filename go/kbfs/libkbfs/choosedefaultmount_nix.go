// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !windows

package libkbfs

import (
	"github.com/keybase/client/go/logger"
	"golang.org/x/net/context"
)

func chooseDefaultMount(ctx context.Context, dirs []string, log logger.Logger) (string, error) {
	return "", nil
}
