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

const waitForDirectMountTimeout = 10 * time.Second
const waitForDirectMountPollInterval = time.Second

func (h *KBFSMountHandler) WaitForMounts(ctx context.Context) (active bool, err error) {
	ctx, cancel := context.WithTimeout(ctx, waitForDirectMountTimeout)
	defer cancel()
	mount, err := h.GetCurrentMountDir(ctx)
	if err != nil {
		return false, err
	}
	directMountFileToCheck := filepath.Join(mount, ".kbfs_error")
	ticker := time.NewTicker(waitForDirectMountPollInterval)
	defer ticker.Stop()
	directMountFound, preferredMountFound := false, false
	for !directMountFound || !preferredMountFound {
		select {
		case <-ticker.C:
			if !directMountFound {
				fi, err := os.Stat(directMountFileToCheck)
				if err == nil && !fi.IsDir() {
					directMountFound = true
				}
				// Not check os.IsNotExist here because it can be permission
				// error too. So just wait it out.
			}
			if !preferredMountFound {
				if len(libkb.FindPreferredKBFSMountDirs()) > 0 {
					preferredMountFound = true
				}
			}
		case <-ctx.Done():
			return false, nil
		}
	}
	return true, nil
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
