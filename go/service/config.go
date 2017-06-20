// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	jsonw "github.com/keybase/go-jsonw"
)

type ConfigHandler struct {
	libkb.Contextified
	xp     rpc.Transporter
	svc    *Service
	connID libkb.ConnectionID
}

var _ keybase1.ConfigInterface = (*ConfigHandler)(nil)

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

func (h ConfigHandler) GetValue(_ context.Context, path string) (ret keybase1.ConfigValue, err error) {
	var i interface{}
	i, err = h.G().Env.GetConfig().GetInterfaceAtPath(path)
	if err != nil {
		return ret, err
	}
	if i == nil {
		ret.IsNull = true
	} else {
		switch v := i.(type) {
		case int:
			ret.I = &v
		case string:
			ret.S = &v
		case bool:
			ret.B = &v
		case float64:
			tmp := int(v)
			ret.I = &tmp
		default:
			var b []byte
			b, err = json.Marshal(v)
			if err == nil {
				tmp := string(b)
				ret.O = &tmp
			}
		}
	}
	return ret, err
}

func (h ConfigHandler) SetValue(_ context.Context, arg keybase1.SetValueArg) (err error) {
	w := h.G().Env.GetConfigWriter()
	if arg.Path == "users" {
		err = fmt.Errorf("The field 'users' cannot be edited for fear of config corruption")
		return err
	}
	switch {
	case arg.Value.IsNull:
		w.SetNullAtPath(arg.Path)
	case arg.Value.S != nil:
		w.SetStringAtPath(arg.Path, *arg.Value.S)
	case arg.Value.I != nil:
		w.SetIntAtPath(arg.Path, *arg.Value.I)
	case arg.Value.B != nil:
		w.SetBoolAtPath(arg.Path, *arg.Value.B)
	case arg.Value.O != nil:
		var jw *jsonw.Wrapper
		jw, err = jsonw.Unmarshal([]byte(*arg.Value.O))
		if err == nil {
			err = w.SetWrapperAtPath(arg.Path, jw)
		}
	default:
		err = fmt.Errorf("Bad type for setting a value")
	}
	if err == nil {
		h.G().ConfigReload()
	}
	return err
}

func (h ConfigHandler) ClearValue(_ context.Context, path string) error {
	h.G().Env.GetConfigWriter().DeleteAtPath(path)
	h.G().ConfigReload()
	return nil
}

func (h ConfigHandler) GetExtendedStatus(ctx context.Context, sessionID int) (res keybase1.ExtendedStatus, err error) {
	defer h.G().Trace("ConfigHandler::GetExtendedStatus", func() error { return err })()

	res.Standalone = h.G().Env.GetStandalone()
	res.LogDir = h.G().Env.GetLogDir()

	// Should work in standalone mode too
	if h.G().ConnectionManager != nil {
		res.Clients = h.G().ConnectionManager.ListAllLabeledConnections()
	}

	err = h.G().GetFullSelfer().WithSelf(ctx, func(me *libkb.User) error {
		device, err := me.GetComputedKeyFamily().GetCurrentDevice(h.G())
		if err != nil {
			h.G().Log.Debug("| GetCurrentDevice failed: %s", err)
			res.DeviceErr = &keybase1.LoadDeviceErr{Where: "ckf.GetCurrentDevice", Desc: err.Error()}
		} else {
			res.Device = device.ProtExport()
		}

		if me != nil && h.G().SecretStoreAll != nil {
			s, err := h.G().SecretStoreAll.RetrieveSecret(me.GetNormalizedName())
			if err == nil && !s.IsNil() {
				res.StoredSecret = true
			}
		}
		return nil
	})
	if err != nil {
		h.G().Log.Debug("| could not load me user: %s", err)
		res.DeviceErr = &keybase1.LoadDeviceErr{Where: "libkb.LoadMe", Desc: err.Error()}
	}

	// cached device key status
	_, _, _, sk, ek := h.G().ActiveDevice.AllFields()
	res.DeviceSigKeyCached = sk != nil
	res.DeviceEncKeyCached = ek != nil

	h.G().LoginState().Account(func(a *libkb.Account) {
		res.PassphraseStreamCached = a.PassphraseStreamCache().ValidPassphraseStream()
		res.TsecCached = a.PassphraseStreamCache().ValidTsec()

		// cached paper key status
		if a.GetUnlockedPaperSigKey() != nil {
			res.PaperSigKeyCached = true
		}
		if a.GetUnlockedPaperEncKey() != nil {
			res.PaperEncKeyCached = true
		}

		res.SecretPromptSkip = a.SkipSecretPrompt()

		if a.LoginSession() != nil {
			res.Session = a.LoginSession().Status()
		}
	}, "ConfigHandler::GetExtendedStatus")

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
	res.DefaultDeviceID = h.G().Env.GetDeviceID()

	return res, nil
}

func (h ConfigHandler) GetConfig(_ context.Context, sessionID int) (keybase1.Config, error) {
	var c keybase1.Config

	c.ServerURI = h.G().Env.GetServerURI()
	c.RunMode = string(h.G().Env.GetRunMode())
	var err error
	c.SocketFile, err = h.G().Env.GetSocketBindFile()
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

func (h ConfigHandler) SetPath(_ context.Context, arg keybase1.SetPathArg) error {
	h.G().Log.Debug("SetPath calling mergeIntoPath(%s)", arg.Path)
	return mergeIntoPath(h.G(), arg.Path)
}

func mergeIntoPath(g *libkb.GlobalContext, p2 string) error {

	svcPath := os.Getenv("PATH")
	g.Log.Debug("mergeIntoPath: service path = %s", svcPath)
	g.Log.Debug("mergeIntoPath: merge path   = %s", p2)

	pathenv := filepath.SplitList(svcPath)
	pathset := make(map[string]bool)
	for _, p := range pathenv {
		pathset[p] = true
	}

	var clientAdditions []string
	for _, dir := range filepath.SplitList(p2) {
		if _, ok := pathset[dir]; ok {
			continue
		}
		clientAdditions = append(clientAdditions, dir)
	}

	pathenv = append(pathenv, clientAdditions...)
	combined := strings.Join(pathenv, string(os.PathListSeparator))

	if combined == svcPath {
		g.Log.Debug("No path changes needed")
		return nil
	}

	g.Log.Debug("mergeIntoPath: merged path = %s", combined)
	os.Setenv("PATH", combined)
	return nil
}

func (h ConfigHandler) HelloIAm(_ context.Context, arg keybase1.ClientDetails) error {
	h.G().Log.Debug("HelloIAm: %d - %+v", h.connID, arg)
	return h.G().ConnectionManager.Label(h.connID, arg)
}

func (h ConfigHandler) CheckAPIServerOutOfDateWarning(_ context.Context) (keybase1.OutOfDateInfo, error) {
	return h.G().GetOutOfDateInfo(), nil
}

func (h ConfigHandler) WaitForClient(_ context.Context, arg keybase1.WaitForClientArg) (bool, error) {
	return h.G().ConnectionManager.WaitForClientType(arg.ClientType, arg.Timeout.Duration()), nil
}

func (h ConfigHandler) GetBootstrapStatus(ctx context.Context, sessionID int) (keybase1.BootstrapStatus, error) {
	eng := engine.NewBootstrap(h.G())
	ectx := &engine.Context{NetContext: ctx}
	if err := engine.RunEngine(eng, ectx); err != nil {
		return keybase1.BootstrapStatus{}, err
	}

	return eng.Status(), nil
}
