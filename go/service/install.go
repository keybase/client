// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
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
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *InstallHandler) FuseStatus(_ context.Context, arg keybase1.FuseStatusArg) (keybase1.FuseStatus, error) {
	status := install.KeybaseFuseStatus(arg.BundleVersion, h.G().Log)
	return status, nil
}

func (h *InstallHandler) InstallKBFS(context.Context) (keybase1.InstallResult, error) {
	components := []string{"helper", "fuse", "mountdir", "kbfs"}
	result := install.Install(h.G(), "", "", components, false, 120, h.G().Log)
	return result, nil
}

func (h *InstallHandler) UninstallKBFS(context.Context) (keybase1.UninstallResult, error) {
	components := []string{"helper", "fuse", "mountdir", "kbfs"}
	result := install.Uninstall(context, components, log)
	return result, nil
}
