package engine

import "testing"

type idtest struct {
	assertion string
	valid     bool
}

var idtests = []idtest{
	{"t_alice", true},
	{"t_bob", true},
	{"t_charlie", true},
	{"t_doug", true},
	{"t_ellen", false},
	{"t_ellen", false},
	{"tacovontaco@twitter", false},
	{"t_alice+tacovontaco@twitter", true},
	{"t_alice+tacovontaco@twitter+kbtester2@github", true},
	{"tacovontaco@twitter+kbtester2@github", false},
	{"kbtester2@github", true},
	{"kbtester1@github", true},
	{"kbtester1@twitter", true},
	{"kbtester1@twitter+t_bob", true},
	{"t_charlie+tacovontaco@twitter", true},
	{"t_charlie+tacoplusplus@github", true},
	{"t_charlie+t_alice", false},
	{"t_charlie+kbtester2@github", false},
}

func TestIdentify(t *testing.T) {
	tc := SetupEngineTest(t, "Identify")
	defer tc.Cleanup()

	for _, x := range idtests {
		ctx := &Context{IdentifyUI: &FakeIdentifyUI{}}
		eng := NewIdentify(NewIdentifyArg(x.assertion, false))
		err := RunEngine(eng, ctx)
		if x.valid && err != nil {
			t.Errorf("assertion %q failed unexpectedly: %s", x.assertion, err)
		}
		if !x.valid && err == nil {
			t.Errorf("assertion %q passed unexpectedly", x.assertion)
		}
	}
}

func TestIdentifyWithTracking(t *testing.T) {
	tc := SetupEngineTest(t, "Identify")
	defer tc.Cleanup()

	CreateAndSignupFakeUser(t, "login")

	for _, x := range idtests {
		ctx := &Context{IdentifyUI: &FakeIdentifyUI{}}
		eng := NewIdentify(NewIdentifyArg(x.assertion, true))
		err := RunEngine(eng, ctx)
		if x.valid && err != nil {
			t.Errorf("assertion %q failed unexpectedly: %s", x.assertion, err)
		}
		if !x.valid && err == nil {
			t.Errorf("assertion %q passed unexpectedly", x.assertion)
		}
	}
}

// TestIdentifySelf makes sure that you can identify yourself, via
// empty assertion or your username.  It also tests that the
// withTracking flag can be set to true or false and both will
// work.  This is so clients can identify w/ tracking if they
// don't know if the user is identifying themselves.
func TestIdentifySelf(t *testing.T) {
	tc := SetupEngineTest(t, "Identify")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(t, "login")

	assertions := []string{"", u.Username}
	for _, a := range assertions {
		ctx := &Context{IdentifyUI: &FakeIdentifyUI{}}
		eng := NewIdentify(NewIdentifyArg(a, false))
		if err := RunEngine(eng, ctx); err != nil {
			t.Errorf("identify self (%q) (withTracking = false) failed: %s", a, err)
		}
		eng = NewIdentify(NewIdentifyArg(a, true))
		if err := RunEngine(eng, ctx); err != nil {
			t.Errorf("identify self (%q) (withTracking = true) failed: %s", a, err)
		}
	}
}
