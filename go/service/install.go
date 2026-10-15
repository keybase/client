// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"context"
	"runtime"
	"time"

	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type InstallHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewInstallHandler(xp rpc.Transporter, g *libkb.GlobalContext) *InstallHandler {
	return &InstallHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *InstallHandler) FuseStatus(_ context.Context, arg keybase1.FuseStatusArg) (keybase1.FuseStatus, error) {
	status := install.KeybaseFuseStatus(arg.BundleVersion, h.G().Log)
	mountDir, err := h.G().Env.GetMountDir()
	if err != nil {
		h.G().Log.Warning("Unable to get the mount dir; reporting no KBFS mount: %s", err)
	}
	install.FilterKBFSMountInfos(&status, mountDir)
	return status, nil
}

func (h *InstallHandler) InstallFuse(context.Context) (keybase1.InstallResult, error) {
	components := []string{"fuse"}
	result := install.Install(
		h.G(), "", components, false, 120*time.Second, h.G().Log)
	return result, nil
}

// setMountOptIn records whether the user wants KBFS mounted (Finder access).
// It is only kept on macOS, where mounting needs the user's macFUSE.
func (h *InstallHandler) setMountOptIn(enabled bool) {
	if runtime.GOOS != "darwin" {
		return
	}
	if err := install.SetMountOptIn(h.G(), enabled); err != nil {
		h.G().Log.Warning("Unable to record the Finder access choice: %s", err)
	}
}

func (h *InstallHandler) InstallKBFS(context.Context) (keybase1.InstallResult, error) {
	h.setMountOptIn(true)
	components := []string{"kbfs"}
	result := install.Install(
		h.G(), "", components, false, 120*time.Second, h.G().Log)
	return result, nil
}

// UninstallKBFS unmounts KBFS and restarts it unmounted, since chat and the
// in-app Files tab still need it.
func (h *InstallHandler) UninstallKBFS(context.Context) (keybase1.UninstallResult, error) {
	h.setMountOptIn(false)
	components := []string{"kbfs"}
	result := install.Uninstall(h.G(), components, h.G().Log)
	restart := install.Install(
		h.G(), "", components, false, 120*time.Second, h.G().Log)
	result.ComponentResults = append(result.ComponentResults, restart.ComponentResults...)
	if result.Status.Code == 0 {
		result.Status = restart.Status
	}
	return result, nil
}
