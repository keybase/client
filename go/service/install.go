// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"time"

	"golang.org/x/net/context"

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
	return status, nil
}

func (h *InstallHandler) InstallFuse(context.Context) (keybase1.InstallResult, error) {
	components := []string{"helper", "fuse"}
	result := install.Install(
		h.G(), "", "", components, false, 120*time.Second, h.G().Log)
	return result, nil
}

func (h *InstallHandler) InstallKBFS(context.Context) (keybase1.InstallResult, error) {
	components := []string{"mountdir", "kbfs", "redirector"}
	result := install.Install(
		h.G(), "", "", components, false, 120*time.Second, h.G().Log)
	return result, nil
}

func (h *InstallHandler) UninstallKBFS(context.Context) (keybase1.UninstallResult, error) {
	// If we're uninstalling the FUSE kext, we need to uninstall the
	// redirector first because it uses that module. That means one
	// user's uninstall request will affect the other users on the
	// same machine -- but that was true anyway when uninstalling the
	// kext if the other users didn't have KBFS actively mounted.
	components := []string{"redirector", "kbfs", "mountdir", "fuse"}
	result := install.Uninstall(h.G(), components, h.G().Log)
	return result, nil
}

func (h *InstallHandler) InstallCommandLinePrivileged(context.Context) (keybase1.InstallResult, error) {
	components := []string{"clipaths"}
	result := install.Install(
		h.G(), "", "", components, false, 120*time.Second, h.G().Log)
	return result, nil
}
