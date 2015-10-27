package systests

import (
	"path/filepath"
	"testing"

	"github.com/keybase/client/go/libkb"
)

func setupTest(t *testing.T, nm string) *libkb.TestContext {
	tc := libkb.SetupTest(t, nm)
	tc.SetSocketFile(filepath.Join(tc.Tp.Home, libkb.SocketFile))
	if err := tc.G.ConfigureSocketInfo(); err != nil {
		t.Fatal(err)
	}
	return &tc
}

func cloneContext(prev *libkb.TestContext) *libkb.TestContext {
	ret := prev.Clone()
	ret.SetSocketFile(filepath.Join(ret.Tp.Home, libkb.SocketFile))
	if err := ret.G.ConfigureSocketInfo(); err != nil {
		ret.T.Fatal(err)
	}
	return &ret
}

type baseNullUI struct {
	g *libkb.GlobalContext
}

func (n *baseNullUI) GetDoctorUI() libkb.DoctorUI                     { return nil }
func (n *baseNullUI) GetIdentifyUI() libkb.IdentifyUI                 { return nil }
func (n *baseNullUI) GetIdentifySelfUI() libkb.IdentifyUI             { return nil }
func (n *baseNullUI) GetIdentifyTrackUI(strict bool) libkb.IdentifyUI { return nil }
func (n *baseNullUI) GetLoginUI() libkb.LoginUI                       { return nil }
func (n *baseNullUI) GetTerminalUI() libkb.TerminalUI                 { return nil }
func (n *baseNullUI) GetSecretUI() libkb.SecretUI                     { return nil }
func (n *baseNullUI) GetProveUI() libkb.ProveUI                       { return nil }
func (n *baseNullUI) GetGPGUI() libkb.GPGUI                           { return nil }
func (n *baseNullUI) GetLogUI() libkb.LogUI                           { return n.g.Log }
func (n *baseNullUI) GetLocksmithUI() libkb.LocksmithUI               { return nil }
func (n *baseNullUI) GetIdentifyLubaUI() libkb.IdentifyUI             { return nil }
func (n *baseNullUI) GetProvisionUI(bool) libkb.ProvisionUI           { return nil }

func (n *baseNullUI) Configure() error { return nil }
func (n *baseNullUI) Shutdown() error  { return nil }
