// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package systests

import (
	"fmt"
	"io"
	"path/filepath"
	"testing"

	"github.com/keybase/client/go/libkb"
)

func setupTest(t *testing.T, nm string) *libkb.TestContext {
	tc := libkb.SetupTest(t, nm)
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
func (n *baseNullUI) GetUpdateUI() libkb.UpdateUI                    { return nil }
func (n *baseNullUI) GetProvisionUI(libkb.KexRole) libkb.ProvisionUI { return nil }

func (n *baseNullUI) Configure() error { return nil }
func (n *baseNullUI) Shutdown() error  { return nil }

type baseTerminalUI struct {
	g *libkb.GlobalContext
}

func (b *baseTerminalUI) OutputWriter() io.Writer {
	return b
}
func (b *baseTerminalUI) ErrorWriter() io.Writer {
	return b
}
func (b *baseTerminalUI) Write(x []byte) (int, error) {
	b.g.Log.Debug("Terminal write: %s", string(x))
	return len(x), nil
}
func (b *baseTerminalUI) Output(s string) error {
	b.g.Log.Debug("Terminal Output: %s", s)
	return nil
}
func (b *baseTerminalUI) Printf(f string, args ...interface{}) (int, error) {
	s := fmt.Sprintf(f, args...)
	b.g.Log.Debug("Terminal Printf: %s", s)
	return len(s), nil
}
func (b *baseTerminalUI) PromptForConfirmation(prompt string) error { return nil }
func (b *baseTerminalUI) PromptPassword(libkb.PromptDescriptor, string) (string, error) {
	return "", nil
}
func (b *baseTerminalUI) PromptYesNo(pd libkb.PromptDescriptor, _ string, _ libkb.PromptDefault) (bool, error) {
	return false, fmt.Errorf("unhandled yes/no prompt: %v", pd)
}
func (b *baseTerminalUI) Prompt(pd libkb.PromptDescriptor, _ string) (string, error) {
	return "", fmt.Errorf("unhandled prompt: %v", pd)
}
