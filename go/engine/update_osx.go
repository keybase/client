// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin,!ios

package engine

import (
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol"
)

func AfterUpdateApply(g *libkb.GlobalContext, willRestart bool) error {
	if !willRestart {
		return nil
	}

	fuseStatus, err := install.KeybaseFuseStatusForAppBundle("/Applications/Keybase.app", g.Log)
	if err != nil {
		return err
	}

	g.Log.Debug("Fuse status: %s", fuseStatus)

	hasKBFuseMounts := false
	for _, mountInfo := range fuseStatus.MountInfos {
		if mountInfo.Fstype == "kbfuse" {
			hasKBFuseMounts = true
			break
		}
	}

	if fuseStatus.InstallAction == keybase1.InstallAction_UPGRADE && hasKBFuseMounts {
		g.Log.Info("Fuse needs upgrade and we have mounts, let's uninstall KBFS so the installer can upgrade after app restart")
		install.Uninstall(g, []string{"kbfs"})
	}

	return nil
}
