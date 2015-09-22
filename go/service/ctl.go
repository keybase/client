package service

import (
	"os"
	"time"

	"github.com/keybase/client/go/engine"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CtlHandler struct {
	*BaseHandler
}

func NewCtlHandler(xp *rpc2.Transport) *CtlHandler {
	return &CtlHandler{BaseHandler: NewBaseHandler(xp)}
}

// Stop is called on the rpc keybase.1.ctl.stop, which shuts down the service.
func (c *CtlHandler) Stop(sessionID int) error {
	G.Log.Info("Received stop() RPC; shutting down")
	go func() {
		time.Sleep(1 * time.Second)
		G.Shutdown()
		os.Exit(0)
	}()
	return nil
}

func (c *CtlHandler) LogRotate(sessionID int) error {
	return G.Log.RotateLogFile()
}

func (c *CtlHandler) SetLogLevel(arg keybase1.SetLogLevelArg) error {
	G.Log.SetExternalLogLevel(arg.Level)
	return nil
}

func (c *CtlHandler) Reload(sessionID int) error {
	G.Log.Info("Reloading config file")
	return G.ConfigReload()
}

func (c *CtlHandler) DbNuke(sessionID int) error {
	ctx := engine.Context{
		LogUI: c.getLogUI(sessionID),
	}

	fn, err := G.LocalDb.Nuke()
	if err != nil {
		ctx.LogUI.Warning("Failed to nuke DB: %s", err)
		return err
	}
	ctx.LogUI.Warning("Nuking database %s", fn)

	// Now drop caches, since we had the DB's state in-memory too.
	return G.ConfigureCaches()
}
