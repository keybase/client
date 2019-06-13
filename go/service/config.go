// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/status"
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

func (h ConfigHandler) GetCurrentStatus(ctx context.Context, sessionID int) (res keybase1.CurrentStatus, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	return status.GetCurrentStatus(mctx)
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
		err = w.SetNullAtPath(arg.Path)
	case arg.Value.S != nil:
		err = w.SetStringAtPath(arg.Path, *arg.Value.S)
	case arg.Value.I != nil:
		err = w.SetIntAtPath(arg.Path, *arg.Value.I)
	case arg.Value.B != nil:
		err = w.SetBoolAtPath(arg.Path, *arg.Value.B)
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

func (h ConfigHandler) GetClientStatus(ctx context.Context, sessionID int) (res []keybase1.ClientStatus, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.TraceTimed("GetClientStatus", func() error { return err })()
	return libkb.GetClientStatus(mctx), nil
}

func (h ConfigHandler) GetConfig(ctx context.Context, sessionID int) (res keybase1.Config, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.TraceTimed("GetConfig", func() error { return err })()
	forkType := keybase1.ForkType_NONE
	if h.svc != nil {
		forkType = h.svc.ForkType
	}
	return status.GetConfig(mctx, forkType)
}

func (h ConfigHandler) GetFullStatus(ctx context.Context, sessionID int) (res *keybase1.FullStatus, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.TraceTimed("GetFullStatus", func() error { return err })()
	return status.GetFullStatus(mctx)
}

func (h ConfigHandler) LogSend(ctx context.Context, arg keybase1.LogSendArg) (res keybase1.LogSendID, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.TraceTimed("LogSend", func() error { return err })()

	fstatus, err := status.GetFullStatus(mctx)
	if err != nil {
		return "", err
	}
	statusJSON := status.MergeStatusJSON(fstatus, "fstatus", arg.StatusJSON)

	numBytes := status.LogSendDefaultBytesDesktop
	if arg.SendMaxBytes {
		numBytes = status.LogSendMaxBytes
	}

	logSendContext := status.NewLogSendContext(h.G(), fstatus, statusJSON, arg.Feedback)
	return logSendContext.LogSend(arg.SendLogs, numBytes,
		false /* mergeExtendedStatus */)
}

func (h ConfigHandler) GetAllProvisionedUsernames(ctx context.Context, sessionID int) (res keybase1.AllProvisionedUsernames, err error) {
	defaultUsername, all, err := libkb.GetAllProvisionedUsernames(libkb.NewMetaContext(ctx, h.G()))
	if err != nil {
		return res, err
	}

	// If the default is missing, fill it in from the first provisioned.
	if defaultUsername.IsNil() && len(all) > 0 {
		defaultUsername = all[0]
	}
	hasProvisionedUser := !defaultUsername.IsNil()

	// Callers expect ProvisionedUsernames to contain the DefaultUsername, so
	// we ensure it is here as a final sanity check before returning.
	hasDefaultUsername := false
	provisionedUsernames := []string{}
	for _, username := range all {
		provisionedUsernames = append(provisionedUsernames, username.String())
		hasDefaultUsername = hasDefaultUsername || username.Eq(defaultUsername)
	}

	if !hasDefaultUsername && hasProvisionedUser {
		provisionedUsernames = append(provisionedUsernames, defaultUsername.String())
	}

	return keybase1.AllProvisionedUsernames{
		DefaultUsername:      defaultUsername.String(),
		ProvisionedUsernames: provisionedUsernames,
		HasProvisionedUser:   hasProvisionedUser,
	}, nil
}

func (h ConfigHandler) SetUserConfig(ctx context.Context, arg keybase1.SetUserConfigArg) (err error) {
	eng := engine.NewUserConfigEngine(h.G(), &engine.UserConfigEngineArg{
		Key:   arg.Key,
		Value: arg.Value,
	})
	m := libkb.NewMetaContext(ctx, h.G())
	err = engine.RunEngine2(m, eng)
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
	tmp := fmt.Sprintf("%v", arg.Argv)
	re := regexp.MustCompile(`\b(chat|encrypt|git|accept-invite|wallet\s+send|wallet\s+import|passphrase\s+check)\b`)
	if mtch := re.FindString(tmp); len(mtch) > 0 {
		arg.Argv = []string{arg.Argv[0], mtch, "(redacted)"}
	}
	h.G().Log.Debug("HelloIAm: %d - %v", h.connID, arg)
	return h.G().ConnectionManager.Label(h.connID, arg)
}

func (h ConfigHandler) CheckAPIServerOutOfDateWarning(_ context.Context) (keybase1.OutOfDateInfo, error) {
	return h.G().GetOutOfDateInfo(), nil
}

func (h ConfigHandler) GetUpdateInfo(ctx context.Context) (keybase1.UpdateInfo, error) {
	outOfDateInfo := h.G().GetOutOfDateInfo()
	if len(outOfDateInfo.UpgradeTo) != 0 {
		// This is from the API server. Consider client critically out of date
		// if we are asked to upgrade by the API server.
		return keybase1.UpdateInfo{
			Status:  keybase1.UpdateInfoStatus_CRITICALLY_OUT_OF_DATE,
			Message: outOfDateInfo.CustomMessage,
		}, nil
	}
	needUpdate, err := install.GetNeedUpdate() // This is from the updater.
	if err != nil {
		h.G().Log.Errorf("Error calling updater: %s", err)
		return keybase1.UpdateInfo{
			Status: keybase1.UpdateInfoStatus_UP_TO_DATE,
		}, err
	}
	if needUpdate {
		return keybase1.UpdateInfo{
			Status: keybase1.UpdateInfoStatus_NEED_UPDATE,
		}, nil
	}
	return keybase1.UpdateInfo{
		Status: keybase1.UpdateInfoStatus_UP_TO_DATE,
	}, nil
}

func (h ConfigHandler) StartUpdateIfNeeded(ctx context.Context) error {
	return install.StartUpdateIfNeeded(ctx, h.G().Log)
}

func (h ConfigHandler) WaitForClient(_ context.Context, arg keybase1.WaitForClientArg) (bool, error) {
	return h.G().ConnectionManager.WaitForClientType(arg.ClientType, arg.Timeout.Duration()), nil
}

func (h ConfigHandler) GetBootstrapStatus(ctx context.Context, sessionID int) (keybase1.BootstrapStatus, error) {
	eng := engine.NewBootstrap(h.G())
	m := libkb.NewMetaContext(ctx, h.G())
	if err := engine.RunEngine2(m, eng); err != nil {
		return keybase1.BootstrapStatus{}, err
	}

	return eng.Status(), nil
}

func (h ConfigHandler) GetRememberPassphrase(ctx context.Context, sessionID int) (bool, error) {
	return h.G().Env.RememberPassphrase(), nil
}

func (h ConfigHandler) SetRememberPassphrase(ctx context.Context, arg keybase1.SetRememberPassphraseArg) error {
	m := libkb.NewMetaContext(ctx, h.G())
	remember, err := h.GetRememberPassphrase(ctx, arg.SessionID)
	if err != nil {
		return err
	}
	if remember == arg.Remember {
		m.Debug("SetRememberPassphrase: no change necessary (remember = %v)", remember)
		return nil
	}

	// set the config variable
	w := h.G().Env.GetConfigWriter()
	if err := w.SetRememberPassphrase(arg.Remember); err != nil {
		return err
	}
	h.G().ConfigReload()

	// replace the secret store
	if err := h.G().ReplaceSecretStore(ctx); err != nil {
		m.Debug("error replacing secret store for SetRememberPassphrase(%v): %s", arg.Remember, err)
		return err
	}

	m.Debug("SetRememberPassphrase(%v) success", arg.Remember)

	return nil
}

type rawGetPkgCheck struct {
	Status libkb.AppStatus      `json:"status"`
	Res    keybase1.UpdateInfo2 `json:"res"`
}

func (r *rawGetPkgCheck) GetAppStatus() *libkb.AppStatus {
	return &r.Status
}

func (h ConfigHandler) GetUpdateInfo2(ctx context.Context, arg keybase1.GetUpdateInfo2Arg) (res keybase1.UpdateInfo2, err error) {
	m := libkb.NewMetaContext(ctx, h.G())

	var version string
	var platform string

	if arg.Platform != nil {
		platform = *arg.Platform
	} else {
		platform = libkb.GetPlatformString()
	}
	if arg.Version != nil {
		version = *arg.Version
	} else {
		version = libkb.VersionString()
	}

	apiArg := libkb.APIArg{
		Endpoint: "pkg/check",
		Args: libkb.HTTPArgs{
			"version":  libkb.S{Val: version},
			"platform": libkb.S{Val: platform},
		},
		RetryCount: 3,
	}
	var raw rawGetPkgCheck
	if err = m.G().API.GetDecode(m, apiArg, &raw); err != nil {
		return res, err
	}
	return raw.Res, nil
}
