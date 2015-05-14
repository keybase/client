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
	arg := &ProveCheckArg{Service: "twitter", Username: "tacovontaco"}
	eng := NewProveCheck(tc.G, arg)
	err := RunEngine(eng, ctx)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if _, ok := err.(libkb.ProofNotFoundForServiceError); !ok {
		t.Errorf("expected libkb.ProofNotFoundForServiceError, got %T (%s)", err, err)
	}
}
