// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/launchd"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type CtlHandler struct {
	libkb.Contextified
	service *Service
	*BaseHandler
}

func NewCtlHandler(xp rpc.Transporter, v *Service, g *libkb.GlobalContext) *CtlHandler {
	return &CtlHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
		service:      v,
	}
}

// Stop is called on the rpc keybase.1.ctl.stop, which shuts down the service.
func (c *CtlHandler) Stop(_ context.Context, args keybase1.StopArg) error {
	c.G().Log.Debug("Received stop(%d) RPC; shutting down", args.ExitCode)

	if c.service.ForkType == keybase1.ForkType_LAUNCHD {
		c.stopLaunchd()
	}

	go c.service.Stop(args.ExitCode)

	return nil
}

func (c *CtlHandler) stopLaunchd() {
	status := install.KeybaseServiceStatus(c.G(), c.G().Env.GetLabel())
	if status.Pid == "" {
		c.G().Log.Debug("Service does not appear to be running via launchd (label = %q)", c.G().Env.GetLabel())
		return
	}

	c.G().Log.Debug("Removing %s from launchd", status.Label)
	svc := launchd.NewService(status.Label)
	if err := svc.Stop(false); err != nil {
		c.G().Log.Warning("error stopping launchd service:", err)
	}
}

func (c *CtlHandler) LogRotate(_ context.Context, sessionID int) error {
	return c.G().Log.RotateLogFile()
}

func (c *CtlHandler) Reload(_ context.Context, sessionID int) error {
	c.G().Log.Info("Reloading config file")
	return c.G().ConfigReload()
}

func (c *CtlHandler) DbNuke(_ context.Context, sessionID int) error {
	ctx := engine.Context{
		LogUI:     c.getLogUI(sessionID),
		SessionID: sessionID,
	}

	fn, err := c.G().LocalDb.Nuke()
	if err != nil {
		ctx.LogUI.Warning("Failed to nuke DB: %s", err)
		return err
	}
	ctx.LogUI.Warning("Nuking database %s", fn)

	// Now drop caches, since we had the DB's state in-memory too.
	return c.G().ConfigureCaches()
}
