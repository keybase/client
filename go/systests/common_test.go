// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package systests

import (
	"path/filepath"
	"testing"

	"github.com/keybase/client/go/libkb"
)

func setupTest(t *testing.T, nm string) *libkb.TestContext {
	tc := libkb.SetupTest(t, nm, 2)
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
