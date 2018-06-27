// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package systests

import (
	"fmt"
	"path/filepath"
	"testing"
	"time"

	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
	context "golang.org/x/net/context"
)

func setupTest(t libkb.TestingTB, nm string) *libkb.TestContext {
	tc := externalstest.SetupTest(t, nm, 2)
	installInsecureTriplesec(tc.G)
	tc.SetRuntimeDir(filepath.Join(tc.Tp.Home, "run"))
	if err := tc.G.ConfigureSocketInfo(); err != nil {
		t.Fatal(err)
	}
	return &tc
}

func cloneContext(prev *libkb.TestContext) *libkb.TestContext {
	ret := prev.Clone()
	ret.SetRuntimeDir(filepath.Join(ret.Tp.Home, "run"))
	if err := ret.G.ConfigureSocketInfo(); err != nil {
		ret.T.Fatal(err)
	}
	return &ret
}

type baseNullUI struct {
	g *libkb.GlobalContext
}

type dumbUI struct{}

func (d dumbUI) Printf(format string, args ...interface{}) (int, error) {
	return 0, nil
}
func (d dumbUI) PrintfStderr(format string, args ...interface{}) (int, error) {
	return 0, nil
}
func (d dumbUI) PrintfUnescaped(format string, args ...interface{}) (int, error) {
	return 0, nil
}

func (n *baseNullUI) GetDumbOutputUI() libkb.DumbOutputUI            { return dumbUI{} }
func (n *baseNullUI) GetIdentifyUI() libkb.IdentifyUI                { return nil }
func (n *baseNullUI) GetIdentifySelfUI() libkb.IdentifyUI            { return nil }
func (n *baseNullUI) GetIdentifyTrackUI() libkb.IdentifyUI           { return nil }
func (n *baseNullUI) GetLoginUI() libkb.LoginUI                      { return nil }
func (n *baseNullUI) GetTerminalUI() libkb.TerminalUI                { return nil }
func (n *baseNullUI) GetSecretUI() libkb.SecretUI                    { return nil }
func (n *baseNullUI) GetProveUI() libkb.ProveUI                      { return nil }
func (n *baseNullUI) GetGPGUI() libkb.GPGUI                          { return nil }
func (n *baseNullUI) GetLogUI() libkb.LogUI                          { return n.g.Log }
func (n *baseNullUI) GetPgpUI() libkb.PgpUI                          { return nil }
func (n *baseNullUI) GetProvisionUI(libkb.KexRole) libkb.ProvisionUI { return nil }

func (n *baseNullUI) Configure() error { return nil }
func (n *baseNullUI) Shutdown() error  { return nil }

type genericUI struct {
	g               *libkb.GlobalContext
	DumbOutputUI    libkb.DumbOutputUI
	IdentifyUI      libkb.IdentifyUI
	IdentifySelfUI  libkb.IdentifyUI
	IdentifyTrackUI libkb.IdentifyUI
	LoginUI         libkb.LoginUI
	TerminalUI      libkb.TerminalUI
	SecretUI        libkb.SecretUI
	ProveUI         libkb.ProveUI
	GPGUI           libkb.GPGUI
	LogUI           libkb.LogUI
	PgpUI           libkb.PgpUI
	ProvisionUI     libkb.ProvisionUI
}

func (n *genericUI) GetDumbOutputUI() libkb.DumbOutputUI {
	if n.DumbOutputUI == nil {
		return dumbUI{}
	}
	return n.DumbOutputUI
}
func (n *genericUI) GetIdentifyUI() libkb.IdentifyUI      { return n.IdentifyUI }
func (n *genericUI) GetIdentifySelfUI() libkb.IdentifyUI  { return n.IdentifyUI }
func (n *genericUI) GetIdentifyTrackUI() libkb.IdentifyUI { return n.IdentifyUI }
func (n *genericUI) GetLoginUI() libkb.LoginUI            { return n.LoginUI }
func (n *genericUI) GetTerminalUI() libkb.TerminalUI      { return n.TerminalUI }
func (n *genericUI) GetSecretUI() libkb.SecretUI          { return n.SecretUI }
func (n *genericUI) GetProveUI() libkb.ProveUI            { return n.ProveUI }
func (n *genericUI) GetGPGUI() libkb.GPGUI                { return n.GPGUI }
func (n *genericUI) GetLogUI() libkb.LogUI {
	if n.LogUI == nil {
		return n.g.Log
	}
	return n.LogUI
}
func (n *genericUI) GetPgpUI() libkb.PgpUI                          { return n.PgpUI }
func (n *genericUI) GetProvisionUI(libkb.KexRole) libkb.ProvisionUI { return n.ProvisionUI }

func (n *genericUI) Configure() error { return nil }
func (n *genericUI) Shutdown() error  { return nil }

type nullProvisionUI struct {
	deviceName string
}

func (n nullProvisionUI) ChooseProvisioningMethod(context.Context, keybase1.ChooseProvisioningMethodArg) (ret keybase1.ProvisionMethod, err error) {
	return ret, nil
}
func (n nullProvisionUI) ChooseGPGMethod(context.Context, keybase1.ChooseGPGMethodArg) (ret keybase1.GPGMethod, err error) {
	return ret, nil
}
func (n nullProvisionUI) SwitchToGPGSignOK(context.Context, keybase1.SwitchToGPGSignOKArg) (bool, error) {
	return false, nil
}
func (n nullProvisionUI) ChooseDevice(context.Context, keybase1.ChooseDeviceArg) (ret keybase1.DeviceID, err error) {
	return ret, nil
}
func (n nullProvisionUI) ChooseDeviceType(context.Context, keybase1.ChooseDeviceTypeArg) (ret keybase1.DeviceType, err error) {
	return ret, nil
}
func (n nullProvisionUI) DisplayAndPromptSecret(context.Context, keybase1.DisplayAndPromptSecretArg) (ret keybase1.SecretResponse, err error) {
	return ret, nil
}
func (n nullProvisionUI) DisplaySecretExchanged(context.Context, int) error { return nil }
func (n nullProvisionUI) PromptNewDeviceName(context.Context, keybase1.PromptNewDeviceNameArg) (string, error) {
	return n.deviceName, nil
}
func (n nullProvisionUI) ProvisioneeSuccess(context.Context, keybase1.ProvisioneeSuccessArg) error {
	return nil
}
func (n nullProvisionUI) ProvisionerSuccess(context.Context, keybase1.ProvisionerSuccessArg) error {
	return nil
}

func getActiveDevicesAndKeys(tc *libkb.TestContext, username string) ([]*libkb.Device, []libkb.GenericKey) {
	arg := libkb.NewLoadUserByNameArg(tc.G, username).WithPublicKeyOptional()
	user, err := libkb.LoadUser(arg)
	if err != nil {
		tc.T.Fatal(err)
	}
	sibkeys := user.GetComputedKeyFamily().GetAllActiveSibkeys()
	subkeys := user.GetComputedKeyFamily().GetAllActiveSubkeys()

	activeDevices := []*libkb.Device{}
	for _, device := range user.GetComputedKeyFamily().GetAllDevices() {
		if device.Status != nil && *device.Status == libkb.DeviceStatusActive {
			activeDevices = append(activeDevices, device)
		}
	}
	return activeDevices, append(sibkeys, subkeys...)
}

func pollFor(t *testing.T, label string, totalTime time.Duration, g *libkb.GlobalContext, poller func(i int) bool) {
	t.Logf("pollFor '%s'", label)
	totalTime *= libkb.CITimeMultiplier(g)
	clock := clockwork.NewRealClock()
	start := clock.Now()
	endCh := clock.After(totalTime)
	wait := 10 * time.Millisecond
	var i int
	for {
		satisfied := poller(i)
		since := clock.Since(start)
		t.Logf("pollFor '%s' round:%v -> %v running:%v", label, i, satisfied, since)
		if satisfied {
			t.Logf("pollFor '%s' succeeded after %v attempts over %v", label, i, since)
			return
		}
		if since > totalTime {
			// Game over
			msg := fmt.Sprintf("pollFor '%s' timed out after %v attempts over %v", label, i, since)
			t.Logf(msg)
			require.Fail(t, msg)
			require.FailNow(t, msg)
			return
		}
		t.Logf("pollFor '%s' wait:%v", label, wait)
		select {
		case <-endCh:
		case <-clock.After(wait):
		}
		wait *= 2
		i++
	}
}
