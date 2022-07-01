// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type CtlHandler struct {
	libkb.Contextified
	service *Service
	*BaseHandler
}

func NewCtlHandler(xp rpc.Transporter, v *Service, g *libkb.GlobalContext) *CtlHandler {
	return &CtlHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
		service:      v,
	}
}

// Stop is called on the rpc keybase.1.ctl.stop, which shuts down the service.
func (c *CtlHandler) Stop(ctx context.Context, args keybase1.StopArg) error {
	c.G().Log.Debug("Ctl: Stop: StopAllButService")
	install.StopAllButService(libkb.NewMetaContext(ctx, c.G()), args.ExitCode)
	c.G().Log.Debug("Ctl: Stop: Stopping service")
	c.service.Stop(args.ExitCode)
	return nil
}

func (c *CtlHandler) StopService(ctx context.Context, args keybase1.StopServiceArg) error {
	c.G().Log.Debug("Ctl: StopService")
	c.service.Stop(args.ExitCode)
	return nil
}

func (c *CtlHandler) LogRotate(_ context.Context, sessionID int) error {
	logFile, _ := c.G().Env.GetEffectiveLogFile()
	// Redirect to log file even if not explicitly desired during service call
	return logger.SetLogFileConfig(c.G().Env.GetLogFileConfig(logFile), nil)
}

func (c *CtlHandler) Reload(_ context.Context, sessionID int) error {
	c.G().Log.Info("Reloading config file")
	return c.G().ConfigReload()
}

func (c *CtlHandler) DbClean(ctx context.Context, arg keybase1.DbCleanArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, c.G())
	defer mctx.Trace("DbClean", &err)()
	switch arg.DbType {
	case keybase1.DbType_MAIN:
		return c.G().LocalDb.Clean(arg.Force)
	case keybase1.DbType_CHAT:
		return c.G().LocalChatDb.Clean(arg.Force)
	default:
		return libkb.NewDBError("unsupported DB type")
	}
}

func (c *CtlHandler) DbNuke(ctx context.Context, sessionID int) (err error) {
	mctx := libkb.NewMetaContext(ctx, c.G())
	defer mctx.Trace("DbNuke", &err)()
	logui := c.getLogUI(sessionID)

	fn, err := c.G().LocalDb.Nuke()
	if err != nil {
		logui.Warning("Failed to nuke DB: %s", err)
		return err
	}
	logui.Warning("Nuking database %s", fn)

	fn, err = c.G().LocalChatDb.Nuke()
	if err != nil {
		logui.Warning("Failed to nuke chat DB: %s", err)
		return err
	}
	logui.Warning("Nuking chat database %s", fn)

	// Now drop caches, since we had the DB's state in-memory too.
	c.G().FlushCaches()
	c.G().CallDbNukeHooks(mctx)
	return nil
}

func (c *CtlHandler) AppExit(_ context.Context, sessionID int) error {
	c.G().Log.Debug("Received appExit RPC")
	c.G().NotifyRouter.HandleAppExit()
	return nil
}

func (c *CtlHandler) DbDelete(ctx context.Context, arg keybase1.DbDeleteArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, c.G())
	defer mctx.Trace("DbDelete", &err)()
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
	c.G().FlushCaches()

	return nil
}

func (c *CtlHandler) DbGet(ctx context.Context, arg keybase1.DbGetArg) (ret *keybase1.DbValue, err error) {
	mctx := libkb.NewMetaContext(ctx, c.G())
	defer mctx.Trace("DbGet", &err)()
	key := libkb.ImportDbKey(arg.Key)
	var res []byte
	var found bool
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

func (c *CtlHandler) DbKeysWithPrefixes(ctx context.Context, arg keybase1.DbKeysWithPrefixesArg) (ret []keybase1.DbKey, err error) {
	mctx := libkb.NewMetaContext(ctx, c.G())
	defer mctx.Trace("DbKeysWithPrefixes", &err)()
	var res libkb.DBKeySet
	switch arg.Prefix.DbType {
	case keybase1.DbType_MAIN:
		res, err = c.G().LocalDb.KeysWithPrefixes([]byte(libkb.PrefixString(libkb.ObjType(arg.Prefix.ObjType))))
	case keybase1.DbType_CHAT:
		res, err = c.G().LocalChatDb.KeysWithPrefixes([]byte(libkb.PrefixString(libkb.ObjType(arg.Prefix.ObjType))))
	default:
		return nil, libkb.NewDBError("no such DB type")
	}
	if err != nil {
		return nil, err
	}

	ret = make([]keybase1.DbKey, 0, len(res))
	for k := range res {
		ret = append(ret, keybase1.DbKey{
			DbType:  arg.Prefix.DbType,
			ObjType: int(k.Typ),
			Key:     k.Key,
		})
	}

	return ret, nil
}

func (c *CtlHandler) DbPut(ctx context.Context, arg keybase1.DbPutArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, c.G())
	defer mctx.Trace("DbPut", &err)()
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
	c.G().FlushCaches()

	return nil
}
