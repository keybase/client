// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin

package install

import "github.com/keybase/client/go/protocol/keybase1"

func KeybaseFuseStatus(bundleVersion string, log Log) keybase1.FuseStatus {
	return keybase1.FuseStatus{}
}
