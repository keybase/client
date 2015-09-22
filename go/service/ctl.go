package service

import (
	"os"
	"time"

	keybase1 "github.com/keybase/client/protocol/go"
)

type CtlHandler struct{}

// Stop is called on the rpc keybase.1.ctl.stop, which shuts down the service.
func (c CtlHandler) Stop() error {
	G.Log.Info("Received stop() RPC; shutting down")
	go func() {
		time.Sleep(1 * time.Second)
		G.Shutdown()
		os.Exit(0)
	}()
	return nil
}

func (c CtlHandler) LogRotate() error {
	return G.Log.RotateLogFile()
}

func (c CtlHandler) SetLogLevel(level keybase1.LogLevel) error {
	G.Log.SetExternalLogLevel(level)
	return nil
}

func (c CtlHandler) Reload() error {
	G.Log.Info("Reloading config file")
	return G.ConfigReload()
}

func (c CtlHandler) DbNuke() error {
	err := G.LocalDb.Nuke()
	if err != nil {
		return err
	}

	// Now drop caches, since we had the DB's state in-memory too.
	//return G.ConfigureCaches()
	return err
}
