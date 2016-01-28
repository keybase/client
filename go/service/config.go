// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type ConfigHandler struct {
	libkb.Contextified
	xp     rpc.Transporter
	svc    *Service
	connID libkb.ConnectionID
}

func NewConfigHandler(xp rpc.Transporter, i libkb.ConnectionID, g *libkb.GlobalContext, svc *Service) *ConfigHandler {
	return &ConfigHandler{
		Contextified: libkb.NewContextified(g),
		xp:           xp,
		svc:          svc,
		connID:       i,
	}
}

func (h ConfigHandler) GetCurrentStatus(_ context.Context, sessionID int) (res keybase1.GetCurrentStatusRes, err error) {
	var cs libkb.CurrentStatus
	if cs, err = libkb.GetCurrentStatus(h.G()); err == nil {
		res = cs.Export()
	}
	return
}

func getPlatformInfo() keybase1.PlatformInfo {
	return keybase1.PlatformInfo{
		Os:        runtime.GOOS,
		Arch:      runtime.GOARCH,
		GoVersion: runtime.Version(),
	}
}

func (h ConfigHandler) GetExtendedStatus(_ context.Context, sessionID int) (res keybase1.ExtendedStatus, err error) {
	defer h.G().Trace("ConfigHandler::GetExtendedStatus", func() error { return err })()

	res.Standalone = h.G().Env.GetStandalone()
	res.LogDir = h.G().Env.GetLogDir()
	res.Clients = h.G().ConnectionManager.ListAllLabeledConnections()

	me, err := libkb.LoadMe(libkb.NewLoadUserArg(h.G()))
	if err != nil {
		h.G().Log.Debug("| could not load me user")
	} else {
		device, err := me.GetComputedKeyFamily().GetCurrentDevice(h.G())
		if err != nil {
			h.G().Log.Debug("| GetCurrentDevice failed: %s", err)
		} else {
			res.Device = device.ProtExport()
		}
	}

	h.G().LoginState().Account(func(a *libkb.Account) {
		res.PassphraseStreamCached = a.PassphraseStreamCache().Valid()
		if a.LoginSession() != nil {
			res.Session = a.LoginSession().Status()
		}
	}, "ConfigHandler::GetExtendedStatus")

	// this isn't quite ideal, but if there's a delegated UpdateUI available, then electron is running and connected.
	if h.G().UIRouter != nil {
		updateUI, err := h.G().UIRouter.GetUpdateUI()
		if err == nil && updateUI != nil {
			res.DesktopUIConnected = true
		}
	}

	current, all, err := h.G().GetAllUserNames()
	if err != nil {
		h.G().Log.Debug("| died in GetAllUseranmes()")
		return res, err
	}
	res.DefaultUsername = current.String()
	p := make([]string, len(all))
	for i, u := range all {
		p[i] = u.String()
	}
	res.ProvisionedUsernames = p
	res.PlatformInfo = getPlatformInfo()

	return res, nil
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

func (h ConfigHandler) HelloIAm(_ context.Context, arg keybase1.ClientDetails) error {
	return h.G().ConnectionManager.Label(h.connID, arg)
}
