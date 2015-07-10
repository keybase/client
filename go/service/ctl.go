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

func (c CtlHandler) Panic(message string) error {
	G.Log.Info("Received panic() RPC")
	go func() {
		panic(message)
	}()
	return nil
}

func (c CtlHandler) Status() (keybase1.ServiceStatusRes, error) {
	var status keybase1.ServiceStatusRes
	status.Time = keybase1.ToTime(time.Now())
	return status, nil
}
