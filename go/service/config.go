// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type ConfigHandler struct {
	libkb.Contextified
	xp  rpc.Transporter
	svc *Service
}

func NewConfigHandler(xp rpc.Transporter, g *libkb.GlobalContext, svc *Service) *ConfigHandler {
	return &ConfigHandler{
		Contextified: libkb.NewContextified(g),
		xp:           xp,
		svc:          svc,
	}
}

func (h ConfigHandler) GetCurrentStatus(_ context.Context, sessionID int) (res keybase1.GetCurrentStatusRes, err error) {
	var cs libkb.CurrentStatus
	if cs, err = libkb.GetCurrentStatus(h.G()); err == nil {
		res = cs.Export()
	}
	return
}

func (h ConfigHandler) GetExtendedStatus(_ context.Context, sessionID int) (res keybase1.ExtendedStatus, err error) {
	res.Standalone = h.G().Env.GetStandalone()
	res.LogDir = h.G().Env.GetLogDir()

	me, err := libkb.LoadMe(libkb.NewLoadUserArg(h.G()))
	if err != nil {
		return res, err
	}

	device, err := me.GetComputedKeyFamily().GetCurrentDevice(h.G())
	if err != nil {
		return res, err
	}
	res.DeviceID = device.ID
	if device.Description != nil {
		res.DeviceName = *device.Description
	}
	res.DeviceStatus = device.StatusString()

	h.G().LoginState().PassphraseStreamCache(func(cache *libkb.PassphraseStreamCache) {
		res.PassphraseStreamCached = cache.Valid()
	}, "ConfigHandler::GetExtendedStatus")

	// this isn't quite ideal, but if there's a delegated UpdateUI available, then electron is running and connected.
	if h.G().UIRouter != nil {
		updateUI, err := h.G().UIRouter.GetUpdateUI()
		if err == nil && updateUI != nil {
			res.DesktopUIConnected = true
		}
	}

	return
}

func (h ConfigHandler) GetConfig(_ context.Context, sessionID int) (keybase1.Config, error) {
	var c keybase1.Config

	c.ServerURI = h.G().Env.GetServerURI()
	c.RunMode = string(h.G().Env.GetRunMode())
	var err error
	c.SocketFile, err = h.G().Env.GetSocketFile()
	if err != nil {
		return c, err
	}

	gpg := h.G().GetGpgClient()
	canExec, err := gpg.CanExec()
	if err == nil {
		c.GpgExists = canExec
		c.GpgPath = gpg.Path()
	}

	c.Version = libkb.VersionString()
	c.VersionShort = libkb.Version

	var v []string
	libkb.VersionMessage(func(s string) {
		v = append(v, s)
	})
	c.VersionFull = strings.Join(v, "\n")

	dir, err := filepath.Abs(filepath.Dir(os.Args[0]))
	if err == nil {
		c.Path = dir
	}

	c.ConfigPath = h.G().Env.GetConfigFilename()
	c.Label = h.G().Env.GetLabel()
	if h.svc != nil {
		if h.svc.ForkType == keybase1.ForkType_AUTO {
			c.IsAutoForked = true
		}
		c.ForkType = h.svc.ForkType
	}

	return c, nil
}

func (h ConfigHandler) SetUserConfig(_ context.Context, arg keybase1.SetUserConfigArg) (err error) {
	eng := engine.NewUserConfigEngine(&engine.UserConfigEngineArg{
		Key:   arg.Key,
		Value: arg.Value,
	}, h.G())

	ctx := &engine.Context{}
	err = engine.RunEngine(eng, ctx)
	if err != nil {
		return err
	}
	return nil
}
