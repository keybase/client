// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

//go:build !windows
// +build !windows

package libkbfs

import (
	"context"

	"github.com/keybase/client/go/logger"
)

func chooseDefaultMount(ctx context.Context, dirs []string, log logger.Logger) (string, error) {
	return "", nil
}
