// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"reflect"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type luTest struct {
	name  string
	input string
	err   error
	uid   keybase1.UID
}

var lutests = []luTest{
	{name: "alice", input: "t_alice", uid: "295a7eea607af32040647123732bc819"},
	{name: "bob", input: "t_bob", uid: "afb5eda3154bc13c1df0189ce93ba119"},
	{name: "unknown user", input: "not_a_user", err: libkb.NotFoundError{}},
	{name: "invalid input", input: "spaces aren't allowed", err: libkb.BadNameError("")},
}

func TestLoginUsername(t *testing.T) {
	tc := SetupEngineTest(t, "lu")
	defer tc.Cleanup()

	for _, test := range lutests {
		ctx := &Context{
			LoginUI: &libkb.TestLoginUI{},
		}
		eng := NewLoginUsername(tc.G, test.input)
		if err := RunEngine(eng, ctx); err != nil {
			if test.err == nil {
				t.Errorf("%s: run error %s", test.name, err)
				continue
			} else if reflect.TypeOf(test.err) != reflect.TypeOf(err) {
				t.Errorf("%s: error type %T, expected %T", test.name, err, test.err)
				continue
			} else {
				// error types matched
				continue
			}
		}

		if test.uid == "" {
			continue
		}

		if eng.User() == nil {
			t.Errorf("%s: %q generated nil user", test.name, test.input)
			continue
		}

		if eng.User().GetUID() != test.uid {
			t.Errorf("%s: uid %q, expected %q", test.name, eng.User().GetUID(), test.uid)
		}
	}
}

func TestLoginUsernamePrompt(t *testing.T) {
	tc := SetupEngineTest(t, "lu")
	defer tc.Cleanup()

	for _, test := range lutests {
		ctx := &Context{
			LoginUI: &libkb.TestLoginUI{
				Username: test.input,
			},
		}
		eng := NewLoginUsername(tc.G, "")
		if err := RunEngine(eng, ctx); err != nil {
			if test.err == nil {
				t.Errorf("%s: run error %s", test.name, err)
				continue
			} else if reflect.TypeOf(test.err) != reflect.TypeOf(err) {
				t.Errorf("%s: error type %T, expected %T", test.name, err, test.err)
				continue
			} else {
				// error types matched
				continue
			}
		}

		if test.uid == "" {
			continue
		}

		if eng.User() == nil {
			t.Errorf("%s: %q generated nil user", test.name, test.input)
		}

		if eng.User().GetUID() != test.uid {
			t.Errorf("%s: uid %q, expected %q", test.name, eng.User().GetUID(), test.uid)
		}
	}
}

func TestLoginUsernameEmail(t *testing.T) {
	tcWeb := SetupEngineTest(t, "web")

	username, passphrase := createFakeUserWithNoKeys(tcWeb)

	Logout(tcWeb)
	tc := SetupEngineTest(t, "lu")
	defer tc.Cleanup()

}
