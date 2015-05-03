package service

import (
	"os"
	"time"
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
