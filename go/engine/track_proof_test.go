package engine

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
)

func TestTrackProofStatus(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "track")

	_, them, err := runTrack(tc, fu, "t_alice")
	if err != nil {
		t.Fatal(err)
	}
	defer runUntrack(tc.G, fu, "t_alice")

	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		t.Fatal(err)
	}
	s, err := me.TrackChcainLinkFor(them.GetName(), them.GetUID())
	if err != nil {
		t.Fatal(err)
	}

	fmt.Printf("tracking link:\n%+v\n", s)
	fmt.Printf("payload json:\n%s\n", s.GetPayloadJSON().MarshalPretty())
}
