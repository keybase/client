package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func TestProveCheck(t *testing.T) {
	tc := SetupEngineTest(t, "prove check")
	defer tc.Cleanup()

	CreateAndSignupFakeUser(tc, "login")

	ctx := &Context{}
	var sigID libkb.SigId
	eng := NewProveCheck(tc.G, sigID)
	err := RunEngine(eng, ctx)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if _, ok := err.(libkb.AppStatusError); !ok {
		t.Errorf("expected libkb.AppStatusError, got %T (%s)", err, err)
	}
}
