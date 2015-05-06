package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

func TestDoctor(t *testing.T) {
	tc := SetupEngineTest(t, "Doctor")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "login")

	ctx := &Context{DoctorUI: &docui{}, LoginUI: libkb.TestLoginUI{Username: fu.Username}, SecretUI: fu.NewSecretUI(), LogUI: tc.G.UI.GetLogUI(), LocksmithUI: &lockui{}, GPGUI: &gpgtestui{}}
	t.Logf("ctx: %+v", ctx)
	eng := NewDoctor(tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
}

type docui struct{}

func (d *docui) LoginSelect(s string, o []string) (string, error) {
	return s, nil
}

func (d *docui) DisplayStatus(s keybase1.DoctorStatus) (bool, error) {
	return true, nil
}

func (d *docui) DisplayResult(s string) error {
	return nil
}
