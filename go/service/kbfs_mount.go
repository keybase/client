// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"net/url"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type KBFSMountHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewKBFSMountHandler(xp rpc.Transporter, g *libkb.GlobalContext) *KBFSMountHandler {
	return &KBFSMountHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *KBFSMountHandler) GetCurrentMountDir(ctx context.Context) (res string, err error) {
	return h.G().Env.GetMountDir()
}

func (h *KBFSMountHandler) GetPreferredMountDirs(ctx context.Context) (res []string, err error) {
	res = libkb.FindPreferredKBFSMountDirs()
	directMount, err := h.G().Env.GetMountDir()
	if err != nil {
		return nil, err
	}
	res = append(res, directMount)
	return res, nil
}

func (h *KBFSMountHandler) GetAllAvailableMountDirs(ctx context.Context) (res []string, err error) {
	return getMountDirs()
}

func (h *KBFSMountHandler) SetCurrentMountDir(_ context.Context, drive string) (err error) {
	oldMount, _ := h.G().Env.GetMountDir()
	w := h.G().Env.GetConfigWriter()
	err = w.SetStringAtPath("mountdir", drive)
	if err != nil {
		return err
	}
	err = h.G().ConfigReload()
	if err != nil {
		return err
	}
	return libkb.ChangeMountIcon(oldMount, drive)
}

func getKBFSAfterMountPath(afterKeybase string, backslash bool) string {
	afterMount := afterKeybase
	if len(afterMount) == 0 {
		afterMount = "/"
	}
	if backslash {
		return strings.ReplaceAll(afterMount, "/", `\`)
	}
	return afterMount
}

func getKBFSDeeplinkPath(afterKeybase string) string {
	if len(afterKeybase) == 0 {
		return ""
	}
	var segments []string
	for _, segment := range strings.Split(afterKeybase, "/") {
		segments = append(segments, url.PathEscape(segment))
	}
	return "keybase:/" + strings.Join(segments, "/")
}

func (h *KBFSMountHandler) GetKBFSPathInfo(ctx context.Context, standardPath string) (pathInfo keybase1.KBFSPathInfo, err error) {
	return libkb.GetKBFSPathInfo(standardPath)
}
