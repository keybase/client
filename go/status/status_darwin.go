// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package status

import (
	"strings"

	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func osSpecific(mctx libkb.MetaContext, status *keybase1.FullStatus) error {
	serviceStatus := install.KeybaseServiceStatus(mctx.G(), "service", 0, mctx.G().Log)
	kbfsStatus := install.KeybaseServiceStatus(mctx.G(), "kbfs", 0, mctx.G().Log)

	productVersion, buildVersion, err := libkb.OSVersionAndBuild()
	if err != nil {
		mctx.Debug("Error determining OS version: %s", err)
	}
	status.ExtStatus.PlatformInfo.OsVersion = strings.Join([]string{productVersion, buildVersion}, "-")

	if len(serviceStatus.Pid) > 0 {
		status.Service.Running = true
		status.Service.Pid = serviceStatus.Pid
	}

	if len(kbfsStatus.Pid) > 0 {
		status.Kbfs.Running = true
		status.Kbfs.Pid = kbfsStatus.Pid
	}

	return nil
}
