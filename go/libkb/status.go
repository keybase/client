// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"errors"
	"runtime"
	"strings"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type UserInfo struct {
	UID      keybase1.UID
	Username string
}

type CurrentStatus struct {
	Configured     bool
	Registered     bool
	LoggedIn       bool
	SessionIsValid bool
	User           *User
}

func GetCurrentStatus(ctx context.Context, g *GlobalContext) (res CurrentStatus, err error) {
	cr := g.Env.GetConfig()
	if cr == nil {
		return res, nil
	}
	res.Configured = true
	if uid := cr.GetUID(); uid.Exists() {
		res.Registered = true
		res.User = NewUserThin(cr.GetUsername().String(), uid)
	}
	res.SessionIsValid = g.ActiveDevice.Valid()
	res.LoggedIn = res.SessionIsValid
	return res, nil
}

func getPlatformInfo() keybase1.PlatformInfo {
	return keybase1.PlatformInfo{
		Os:        runtime.GOOS,
		Arch:      runtime.GOARCH,
		GoVersion: runtime.Version(),
	}
}

func GetExtendedStatus(m MetaContext) (res keybase1.ExtendedStatus, err error) {
	defer m.CTrace("GetExtendedStatus", func() error { return err })()
	g := m.G()

	res.Standalone = g.Env.GetStandalone()
	res.LogDir = g.Env.GetLogDir()

	// Should work in standalone mode too
	if g.ConnectionManager != nil {
		res.Clients = g.ConnectionManager.ListAllLabeledConnections()
	}

	if err = g.GetFullSelfer().WithSelf(m.Ctx(), func(me *User) error {
		ckf := me.GetComputedKeyFamily()
		if ckf == nil {
			return errors.New("Couldn't load key family")
		}
		device, err := ckf.GetCurrentDevice(g)
		if err != nil {
			m.CDebugf("| GetCurrentDevice failed: %s", err)
			res.DeviceErr = &keybase1.LoadDeviceErr{Where: "ckf.GetCurrentDevice", Desc: err.Error()}
		} else {
			res.Device = device.ProtExport()
		}

		ss := g.SecretStore()
		if me != nil && ss != nil {
			s, err := ss.RetrieveSecret(m, me.GetNormalizedName())
			if err == nil && !s.IsNil() {
				res.StoredSecret = true
			}
		}
		return nil
	}); err != nil {
		m.CDebugf("| could not load me user: %s", err)
		res.DeviceErr = &keybase1.LoadDeviceErr{Where: "libkb.LoadMe", Desc: err.Error()}
	}

	// cached device key status
	_, _, _, sk, ek := g.ActiveDevice.AllFields()
	res.DeviceSigKeyCached = sk != nil
	res.DeviceEncKeyCached = ek != nil

	ad := m.ActiveDevice()
	// cached paper key status
	if pk := ad.ProvisioningKey(m); pk != nil {
		if pk.EncryptionKey() != nil {
			res.PaperEncKeyCached = true
		}
		if pk.SigningKey() != nil {
			res.PaperSigKeyCached = true
		}
	}

	psc := ad.PassphraseStreamCache()
	res.PassphraseStreamCached = psc.ValidPassphraseStream()
	res.TsecCached = psc.ValidTsec()
	res.SecretPromptSkip = m.ActiveDevice().SecretPromptCancelTimer().WasRecentlyCanceled(m)

	current, all, err := GetAllProvisionedUsernames(m)
	if err != nil {
		m.CDebugf("| died in GetAllUsernames()")
		return res, err
	}
	res.DefaultUsername = current.String()
	p := make([]string, len(all))
	for i, u := range all {
		p[i] = u.String()
	}
	res.ProvisionedUsernames = p
	res.PlatformInfo = getPlatformInfo()
	res.DefaultDeviceID = g.Env.GetDeviceID()
	res.RememberPassphrase = g.Env.RememberPassphrase()
	// DeviceEK status, can be nil if user is logged out
	deviceEKStorage := g.GetDeviceEKStorage()
	if deviceEKStorage != nil {
		dekNames, err := deviceEKStorage.ListAllForUser(m.Ctx())
		if err != nil {
			return res, err
		}
		res.DeviceEkNames = dekNames
	}

	res.LocalDbStats = strings.Split(g.LocalDb.Stats(), "\n")
	res.LocalChatDbStats = strings.Split(g.LocalChatDb.Stats(), "\n")

	return res, nil
}
