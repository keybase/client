// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin

package install

import (
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
)

func Install(context Context, binPath string, sourcePath string, components []string, force bool, timeout time.Duration, log Log) keybase1.InstallResult {
	return keybase1.InstallResult{}
}
