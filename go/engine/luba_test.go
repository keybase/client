package engine

import "testing"

type lubatest struct {
	assertion string
	valid     bool
}

var lubatests = []lubatest{
	{"t_alice", true},
	{"t_bob", true},
	{"t_alice+tacovontaco@twitter", true},
}

func TestLuba(t *testing.T) {
	tc := SetupEngineTest(t, "Luba")
	defer tc.Cleanup()

	for _, lt := range lubatests {
		idUI := &FakeIdentifyUI{}
		ctx := &Context{IdentifyUI: idUI}
		arg := &LubaArg{
			Assertion:    lt.assertion,
			WithTracking: false,
		}
		eng := NewLuba(arg)
		if err := RunEngine(eng, ctx); err != nil {
			if lt.valid {
				t.Errorf("%s generated error: %s", lt.assertion, err)
			}
		} else {
			if !lt.valid {
				t.Errorf("%s should have generated an error", lt.assertion)
			}
		}
	}
}

func TestLubaWithTracking(t *testing.T) {
	tc := SetupEngineTest(t, "Luba")
	defer tc.Cleanup()

	CreateAndSignupFakeUser(t, "login")

	for _, lt := range lubatests {
		idUI := &FakeIdentifyUI{}
		ctx := &Context{IdentifyUI: idUI}
		arg := &LubaArg{
			Assertion:    lt.assertion,
			WithTracking: true,
		}
		eng := NewLuba(arg)
		if err := RunEngine(eng, ctx); err != nil {
			if lt.valid {
				t.Errorf("%s generated error: %s", lt.assertion, err)
			}
		} else {
			if !lt.valid {
				t.Errorf("%s should have generated an error", lt.assertion)
			}
		}
	}
}
