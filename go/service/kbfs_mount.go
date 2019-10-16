// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"os"
	"path/filepath"
	"time"

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

const waitForDirectMountTimeout = time.Second * 10
const waitForDirectMountPollInterval = time.Second

func (h *KBFSMountHandler) WaitForDirectMount(ctx context.Context) (active bool, err error) {
	ctx, cancel := context.WithTimeout(ctx, waitForDirectMountTimeout)
	defer cancel()
	mount, err := h.GetCurrentMountDir(ctx)
	if err != nil {
		return false, err
	}
	p := filepath.Join(mount, ".kbfs_status")
	ticker := time.NewTicker(waitForDirectMountPollInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			fi, err := os.Stat(p)
			if err == nil && fi.IsDir() {
				return true, nil
			}
			// Not check os.IsNotExist here because it can be permission
			// error too. So just wait it out.
			continue
		case <-ctx.Done():
			return false, ctx.Err()
		}
	}
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

func (h *KBFSMountHandler) GetKBFSPathInfo(ctx context.Context, standardPath string) (pathInfo keybase1.KBFSPathInfo, err error) {
	return libkb.GetKBFSPathInfo(standardPath)
}
