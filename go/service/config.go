package service

import (
	"os"
	"path/filepath"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type ConfigHandler struct {
	xp *rpc2.Transport
}

func (h ConfigHandler) GetCurrentStatus(sessionID int) (res keybase1.GetCurrentStatusRes, err error) {
	var cs libkb.CurrentStatus
	if cs, err = libkb.GetCurrentStatus(); err == nil {
		res = cs.Export()
	}
	return
}

func (h ConfigHandler) GetConfig(sessionID int) (keybase1.Config, error) {
	var c keybase1.Config

	c.ServerURI = G.Env.GetServerURI()
	c.RunMode = string(G.Env.GetRunMode())
	var err error
	c.SocketFile, err = G.Env.GetSocketFile()
	if err != nil {
		return c, err
	}

	gpg := G.GetGpgClient()
	canExec, err := gpg.CanExec()
	if err == nil {
		c.GpgExists = canExec
		c.GpgPath = gpg.Path()
	}

	c.Version = libkb.VersionString()

	dir, err := filepath.Abs(filepath.Dir(os.Args[0]))
	if err == nil {
		c.Path = dir
	}

	c.ConfigPath = G.Env.GetConfigFilename()
	c.Label = G.Env.GetLabel()

	return c, nil
}

func (h ConfigHandler) SetUserConfig(arg keybase1.SetUserConfigArg) (err error) {
	eng := engine.NewUserConfigEngine(&engine.UserConfigEngineArg{
		Key:   arg.Key,
		Value: arg.Value,
	}, G)

	ctx := &engine.Context{}
	err = engine.RunEngine(eng, ctx)
	if err != nil {
		return err
	}
	return nil
}
