package engine

import (
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
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

func (d *docui) LoginSelect(_ context.Context, s string, o []string) (string, error) {
	return s, nil
}

func (d *docui) DisplayStatus(_ context.Context, s keybase1.DoctorStatus) (bool, error) {
	return true, nil
}

func (d *docui) DisplayResult(_ context.Context, s string) error {
	return nil
}
