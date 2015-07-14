package engine

import (
	"testing"
)

func TestSetPrimaryPictureSource(t *testing.T) {
	tc := SetupEngineTest(t, "user config")
	defer tc.Cleanup()
	CreateAndSignupFakeUser(tc, "cfg")

	// TODO Setup pictures with multiple sources

	ctx := &Context{
		LogUI: tc.G.UI.GetLogUI(),
	}

	eng := NewUserConfigEngine(&UserConfigEngineArg{
		Key:   "picture.source",
		Value: "github",
	}, tc.G)
	err := RunEngine(eng, ctx)
	if err != nil {
		t.Fatal(err)
	}

	// TODO Check that the primary picture source was changed
}
