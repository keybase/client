// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
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
	go c.service.Stop(args.ExitCode)
	return nil
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

	fn, err = c.G().LocalChatDb.Nuke()
	if err != nil {
		ctx.LogUI.Warning("Failed to nuke chat DB: %s", err)
		return err
	}
	ctx.LogUI.Warning("Nuking chat database %s", fn)

	// Now drop caches, since we had the DB's state in-memory too.
	return c.G().ConfigureCaches()
}

func (c *CtlHandler) AppExit(_ context.Context, sessionID int) error {
	c.G().Log.Debug("Received appExit RPC")
	c.G().NotifyRouter.HandleAppExit()
	return nil
}

func (c *CtlHandler) DbDelete(_ context.Context, arg keybase1.DbDeleteArg) (err error) {
	key := libkb.ImportDbKey(arg.Key)

	switch arg.Key.DbType {
	case keybase1.DbType_MAIN:
		err = c.G().LocalDb.Delete(key)
	case keybase1.DbType_CHAT:
		err = c.G().LocalChatDb.Delete(key)
	default:
		err = libkb.NewDBError("no such DB type")
	}

	if err != nil {
		return err
	}

	c.G().Log.Debug("Clearing memory caches after DbDelete")
	c.G().ConfigureMemCaches()

	return nil
}

func (c *CtlHandler) DbGet(_ context.Context, arg keybase1.DbGetArg) (*keybase1.DbValue, error) {
	key := libkb.ImportDbKey(arg.Key)
	var res []byte
	var found bool
	var err error
	switch arg.Key.DbType {
	case keybase1.DbType_MAIN:
		res, found, err = c.G().LocalDb.GetRaw(key)
	case keybase1.DbType_CHAT:
		res, found, err = c.G().LocalChatDb.GetRaw(key)
	default:
		return nil, libkb.NewDBError("no such DB type")
	}
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, nil
	}
	val := keybase1.DbValue(res)
	return &val, nil
}

func (c *CtlHandler) DbPut(_ context.Context, arg keybase1.DbPutArg) (err error) {
	key := libkb.ImportDbKey(arg.Key)

	switch arg.Key.DbType {
	case keybase1.DbType_MAIN:
		err = c.G().LocalDb.PutRaw(key, []byte(arg.Value))
	case keybase1.DbType_CHAT:
		err = c.G().LocalChatDb.PutRaw(key, []byte(arg.Value))
	default:
		err = libkb.NewDBError("no such DB type")
	}

	if err != nil {
		return err
	}

	c.G().Log.Debug("Clearing memory caches after DbPut")
	c.G().ConfigureMemCaches()

	return nil
}
