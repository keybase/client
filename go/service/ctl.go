package service

import (
	"os"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type CtlHandler struct {
	libkb.Contextified
	*BaseHandler
}

func NewCtlHandler(xp rpc.Transporter, g *libkb.GlobalContext) *CtlHandler {
	return &CtlHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

// Stop is called on the rpc keybase.1.ctl.stop, which shuts down the service.
func (c *CtlHandler) Stop(_ context.Context, sessionID int) error {
	c.G().Log.Info("Received stop() RPC; shutting down")
	go func() {
		time.Sleep(1 * time.Second)
		c.G().Shutdown()
		os.Exit(0)
	}()
	return nil

func (c *CtlHandler) LogRotate(_ context.Context, sessionID int) error {
	return c.G().Log.RotateLogFile()
}

func (c *CtlHandler) SetLogLevel(_ context.Context, arg keybase1.SetLogLevelArg) error {
	c.G().Log.SetExternalLogLevel(arg.Level)
	return nil
}

func (c *CtlHandler) Reload(_ context.Context, sessionID int) error {
	c.G().Log.Info("Reloading config file")
	return c.G().ConfigReload()
}

func (c *CtlHandler) DbNuke(_ context.Context, sessionID int) error {
	ctx := engine.Context{
		LogUI: c.getLogUI(sessionID),
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
