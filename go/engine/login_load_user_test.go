// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"reflect"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
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

func TestLoginLoadUser(t *testing.T) {
	tc := SetupEngineTest(t, "lu")
	defer tc.Cleanup()

	for _, test := range lutests {
		ctx := &Context{
			LoginUI:  &libkb.TestLoginUI{},
			SecretUI: &libkb.TestSecretUI{},
		}
		eng := newLoginLoadUser(tc.G, test.input)
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

func TestLoginLoadUserPrompt(t *testing.T) {
	tc := SetupEngineTest(t, "lu")
	defer tc.Cleanup()

	lutestsPrompt := make([]luTest, len(lutests)+1)
	copy(lutestsPrompt, lutests)
	lutestsPrompt[len(lutestsPrompt)-1] = luTest{name: "empty prompt input", input: "", err: libkb.NoUsernameError{}}

	for _, test := range lutestsPrompt {
		ctx := &Context{
			LoginUI: &libkb.TestLoginUI{
				Username: test.input,
			},
			SecretUI: &libkb.TestSecretUI{},
		}
		eng := newLoginLoadUser(tc.G, "")
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

// test user canceling GetEmailOrUsername prompt:
func TestLoginLoadUserPromptCancel(t *testing.T) {
	tc := SetupEngineTest(t, "lu")
	defer tc.Cleanup()
	ctx := &Context{
		LoginUI:  &libkb.TestLoginCancelUI{},
		SecretUI: &libkb.TestSecretUI{},
	}
	eng := newLoginLoadUser(tc.G, "")
	err := RunEngine(eng, ctx)
	if err == nil {
		t.Fatal("expected an error")
	}
	if _, ok := err.(libkb.InputCanceledError); !ok {
		t.Errorf("error: %s (%T), expected InputCanceledError", err, err)
	}
}

func TestLoginLoadUserEmail(t *testing.T) {
	tcX := SetupEngineTest(t, "other")
	fu := CreateAndSignupFakeUser(tcX, "login")
	Logout(tcX)
	tcX.Cleanup()

	// own email address
	user, err := testLoginLoadUserEmail(t, fu, fu.Email)
	if err != nil {
		t.Fatal(err)
	}
	if user.GetName() != fu.Username {
		t.Errorf("loginLoadUser %q => %q, expected username %q", fu.Email, user.GetName(), fu.Username)
	}

	// prompt for email address
	user, err = testLoginLoadUserEmail(t, fu, "")
	if err != nil {
		t.Fatal(err)
	}
	if user.GetName() != fu.Username {
		t.Errorf("loginLoadUser %q => %q, expected username %q", fu.Email, user.GetName(), fu.Username)
	}

	// someone else's email address
	user, err = testLoginLoadUserEmail(t, fu, "test+t_bob@test.keybase.io")
	if err == nil {
		t.Errorf("bob's email address worked with invalid secret")
	} else if _, ok := err.(libkb.PassphraseError); !ok {
		t.Errorf("error: %s (%T), expected libkb.PassphraseError", err, err)
	}
	if user != nil {
		t.Errorf("got a user for bob's email address")
	}

	// nobody's email address
	user, err = testLoginLoadUserEmail(t, fu, "XXXYYYXXX@test.keybase.io")
	if err == nil {
		t.Errorf("unknown email address worked with invalid secret")
	} else if _, ok := err.(libkb.NotFoundError); !ok {
		t.Errorf("error: %s (%T), expected libkb.NotFoundError", err, err)
	}
	if user != nil {
		t.Errorf("got a user for unknown email address")
	}
}

func testLoginLoadUserEmail(t *testing.T, fu *FakeUser, input string) (*libkb.User, error) {
	tc := SetupEngineTest(t, "lu")
	defer tc.Cleanup()

	ctx := &Context{
		LoginUI: &libkb.TestLoginUI{
			Username: fu.Email,
		},
		SecretUI: fu.NewSecretUI(),
	}
	eng := newLoginLoadUser(tc.G, input)
	if err := RunEngine(eng, ctx); err != nil {
		return nil, err
	}
	return eng.User(), nil
}
