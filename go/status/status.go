// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package status

import (
	"errors"
	"os"
	"path/filepath"
	"strings"

	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

func GetCurrentStatus(mctx libkb.MetaContext) (res keybase1.CurrentStatus, err error) {
	cr := mctx.G().Env.GetConfig()
	if cr == nil {
		return res, nil
	}
	res.Configured = true
	if uid := cr.GetUID(); uid.Exists() {
		res.Registered = true
		res.User = libkb.NewUserThin(cr.GetUsername().String(), uid).Export()
	}
	res.SessionIsValid = mctx.ActiveDevice().Valid()
	res.LoggedIn = res.SessionIsValid
	return res, nil
}

func GetExtendedStatus(mctx libkb.MetaContext) (res keybase1.ExtendedStatus, err error) {
	mctx = mctx.WithLogTag("EXTSTATUS")
	defer mctx.TraceTimed("GetExtendedStatus", func() error { return err })()
	g := mctx.G()

	res.Standalone = g.Env.GetStandalone()
	res.LogDir = g.Env.GetLogDir()
	res.Clients = libkb.GetClientStatus(mctx)

	if err = g.GetFullSelfer().WithSelf(mctx.Ctx(), func(me *libkb.User) error {
		ckf := me.GetComputedKeyFamily()
		if ckf == nil {
			return errors.New("Couldn't load key family")
		}
		device, err := ckf.GetCurrentDevice(g)
		if err != nil {
			mctx.Debug("| GetCurrentDevice failed: %s", err)
			res.DeviceErr = &keybase1.LoadDeviceErr{Where: "ckf.GetCurrentDevice", Desc: err.Error()}
		} else {
			res.Device = device.ProtExport()
		}

		ss := g.SecretStore()
		if me != nil && ss != nil {
			s, err := ss.RetrieveSecret(mctx, me.GetNormalizedName())
			if err == nil && !s.IsNil() {
				res.StoredSecret = true
			}
		}
		return nil
	}); err != nil {
		mctx.Debug("| could not load me user: %s", err)
		res.DeviceErr = &keybase1.LoadDeviceErr{Where: "libkb.LoadMe", Desc: err.Error()}
	}

	// cached device key status
	_, _, _, sk, ek := g.ActiveDevice.AllFields()
	res.DeviceSigKeyCached = sk != nil
	res.DeviceEncKeyCached = ek != nil

	ad := mctx.ActiveDevice()
	// cached paper key status
	if pk := ad.ProvisioningKey(mctx); pk != nil {
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
	res.SecretPromptSkip = mctx.ActiveDevice().SecretPromptCancelTimer().WasRecentlyCanceled(mctx)

	current, all, err := libkb.GetAllProvisionedUsernames(mctx)
	if err != nil {
		mctx.Debug("| died in GetAllProvisionedUsernames()")
		return res, err
	}
	res.DefaultUsername = current.String()
	p := make([]string, len(all))
	for i, u := range all {
		p[i] = u.String()
	}
	res.ProvisionedUsernames = p

	accounts, err := libkb.GetConfiguredAccountsFromProvisionedUsernames(mctx, mctx.G().SecretStore(), current, all)
	if err != nil {
		mctx.Debug("| died in GetConfiguredAccounts()")
		return res, err
	}
	res.ConfiguredAccounts = accounts

	res.PlatformInfo = getPlatformInfo()
	res.DefaultDeviceID = g.Env.GetDeviceID()
	res.RememberPassphrase = g.Env.RememberPassphrase()
	// DeviceEK status, can be nil if user is logged out
	deviceEKStorage := g.GetDeviceEKStorage()
	if deviceEKStorage != nil {
		dekNames, err := deviceEKStorage.ListAllForUser(mctx)
		if err != nil {
			return res, err
		}
		res.DeviceEkNames = dekNames
	}

	res.LocalDbStats = strings.Split(g.LocalDb.Stats(), "\n")
	res.LocalChatDbStats = strings.Split(g.LocalChatDb.Stats(), "\n")
	if cacheSizeInfo, err := CacheSizeInfo(g); err == nil {
		res.CacheDirSizeInfo = cacheSizeInfo
	}

	if g.ConnectionManager != nil {
		xp := g.ConnectionManager.LookupByClientType(keybase1.ClientType_KBFS)
		if xp == nil {
			mctx.Debug("| KBFS stats not available")
		} else {
			cli := &keybase1.SimpleFSClient{
				Cli: rpc.NewClient(
					xp, libkb.NewContextifiedErrorUnwrapper(g), nil),
			}
			stats, err := cli.SimpleFSGetStats(mctx.Ctx())
			if err != nil {
				mctx.Debug("| KBFS stats error: %+v", err)
			} else {
				res.LocalBlockCacheDbStats = stats.BlockCacheDbStats
				res.LocalSyncCacheDbStats = stats.SyncCacheDbStats
			}
		}
	}

	if g.UIRouter != nil {
		uiMapping := map[string]int{}
		for k, v := range g.UIRouter.DumpUIs() {
			uiMapping[k.String()] = int(v)
		}
		res.UiRouterMapping = uiMapping
	}

	return res, nil
}

func GetConfig(mctx libkb.MetaContext, forkType keybase1.ForkType) (c keybase1.Config, err error) {
	serverURI, err := mctx.G().Env.GetServerURI()
	if err != nil {
		return c, err
	}

	c.ServerURI = serverURI
	c.RunMode = string(mctx.G().Env.GetRunMode())
	c.SocketFile, err = mctx.G().Env.GetSocketBindFile()
	if err != nil {
		return c, err
	}

	gpg := mctx.G().GetGpgClient()
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
	} else {
		mctx.Warning("Failed to get service path: %s", err)
	}

	realpath, err := libkb.CurrentBinaryRealpath()
	if err == nil {
		c.BinaryRealpath = realpath
	} else {
		mctx.Warning("Failed to get service realpath: %s", err)
	}

	c.ConfigPath = mctx.G().Env.GetConfigFilename()
	c.Label = mctx.G().Env.GetLabel()
	if forkType == keybase1.ForkType_AUTO {
		c.IsAutoForked = true
	}
	c.ForkType = forkType
	return c, nil
}

func GetFullStatus(mctx libkb.MetaContext) (status *keybase1.FullStatus, err error) {
	status = &keybase1.FullStatus{}
	// The client overrides this value when sending logs
	status.Client.Version = libkb.VersionString()
	status.ConfigPath = mctx.G().Env.GetConfigFilename()

	status.CurStatus, err = GetCurrentStatus(mctx)
	if err != nil {
		return nil, err
	}

	// Duplicate the username at top-level for backwards compatibility of
	// output.
	if status.CurStatus.User != nil {
		status.Username = status.CurStatus.User.Username
	}

	status.ExtStatus, err = GetExtendedStatus(mctx)
	if err != nil {
		return nil, err
	}

	// set service status
	if status.ExtStatus.Standalone {
		status.Service.Running = false
	} else {
		status.Service.Running = true
	}
	status.Service.Version = libkb.VersionString()

	// set kbfs status
	kbfsInstalledVersion, err := install.KBFSBundleVersion(mctx.G(), "")
	if err == nil {
		status.Kbfs.InstalledVersion = kbfsInstalledVersion
	}
	if kbfs := GetFirstClient(status.ExtStatus.Clients, keybase1.ClientType_KBFS); kbfs != nil {
		status.Kbfs.Version = kbfs.Version
		status.Kbfs.Running = true
		// This just gets the mountpoint from the environment; the
		// user could have technically passed a different mountpoint
		// to KBFS on macOS or Linux.  TODO(KBFS-2723): fetch the
		// actual mountpoint with a new RPC from KBFS.
		mountDir, err := mctx.G().Env.GetMountDir()
		if err != nil {
			return nil, err
		}
		status.Kbfs.Mount = mountDir
	} else {
		status.Kbfs.Version = kbfsInstalledVersion
	}

	// set desktop status
	if desktop := GetFirstClient(status.ExtStatus.Clients, keybase1.ClientType_GUI_MAIN); desktop != nil {
		status.Desktop.Running = true
		status.Desktop.Version = desktop.Version
	}

	// set log paths
	status.Service.Log = getServiceLog(mctx, status.ExtStatus.LogDir)
	status.Service.EkLog = filepath.Join(status.ExtStatus.LogDir, libkb.EKLogFileName)
	status.Kbfs.Log = filepath.Join(status.ExtStatus.LogDir, libkb.KBFSLogFileName)
	status.Desktop.Log = filepath.Join(status.ExtStatus.LogDir, libkb.DesktopLogFileName)
	status.Updater.Log = filepath.Join(status.ExtStatus.LogDir, libkb.UpdaterLogFileName)
	status.Start.Log = filepath.Join(status.ExtStatus.LogDir, libkb.StartLogFileName)
	status.Git.Log = filepath.Join(status.ExtStatus.LogDir, libkb.GitLogFileName)

	// set anything os-specific
	if err := osSpecific(mctx, status); err != nil {
		return nil, err
	}
	return status, nil
}
