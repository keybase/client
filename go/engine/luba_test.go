package engine

import "testing"

type lubatest struct {
	assertion    string
	withTracking bool
	valid        bool
}

var lubatests = []lubatest{
	{"t_alice", false, true},
	{"t_bob", false, true},
	{"tacovontaco@twitter", false, true},
}

func TestLuba(t *testing.T) {
	tc := SetupEngineTest(t, "Luba")
	defer tc.Cleanup()

	for _, lt := range lubatests {
		idUI := &FakeIdentifyUI{}
		ctx := &Context{IdentifyUI: idUI}
		arg := &LubaArg{
			Assertion:    lt.assertion,
			WithTracking: lt.withTracking,
		}
		eng := NewLuba(arg)
		if err := RunEngine(eng, ctx, nil, nil); err != nil {
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
