// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"reflect"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
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
	{name: "invalid input", input: "spaces aren't allowed", err: libkb.BadUsernameError{}},
	{name: "bob@example.com", input: "email isn't allowed", err: libkb.BadUsernameError{}},
	{name: "bob=", input: "other not allowed chars", err: libkb.BadUsernameError{}},
}

func TestLoginLoadUser(t *testing.T) {
	tc := SetupEngineTest(t, "lu")
	defer tc.Cleanup()

	for _, test := range lutests {
		uis := libkb.UIs{
			LoginUI:  &libkb.TestLoginUI{},
			SecretUI: &libkb.TestSecretUI{},
		}
		m := NewMetaContextForTest(tc).WithUIs(uis)
		eng := newLoginLoadUser(tc.G, test.input)
		if err := RunEngine2(m, eng); err != nil {
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
		uis := libkb.UIs{
			LoginUI: &libkb.TestLoginUI{
				Username: test.input,
			},
			SecretUI: &libkb.TestSecretUI{},
		}
		eng := newLoginLoadUser(tc.G, "")
		m := NewMetaContextForTest(tc).WithUIs(uis)
		if err := RunEngine2(m, eng); err != nil {
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
	uis := libkb.UIs{
		LoginUI:  &libkb.TestLoginCancelUI{},
		SecretUI: &libkb.TestSecretUI{},
	}
	eng := newLoginLoadUser(tc.G, "")
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
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

	checkEmailResult := func(user *libkb.User, err error) {
		require.Error(t, err)
		require.IsType(t, libkb.BadUsernameError{}, err)
		require.Contains(t, err.Error(), "not supported")
		require.Nil(t, user)
	}

	// own email address
	user, err := testLoginLoadUserEmail(t, fu, fu.Email)
	checkEmailResult(user, err)

	// prompt for email address
	user, err = testLoginLoadUserEmail(t, fu, "")
	checkEmailResult(user, err)

	// someone else's email address
	user, err = testLoginLoadUserEmail(t, fu, "test+t_bob@test.keybase.io")
	checkEmailResult(user, err)

	// nobody's email address
	user, err = testLoginLoadUserEmail(t, fu, "XXXYYYXXX@test.keybase.io")
	checkEmailResult(user, err)
}

func testLoginLoadUserEmail(t *testing.T, fu *FakeUser, input string) (*libkb.User, error) {
	tc := SetupEngineTest(t, "lu")
	defer tc.Cleanup()

	uis := libkb.UIs{
		LoginUI: &libkb.TestLoginUI{
			Username: fu.Email,
		},
		SecretUI: fu.NewSecretUI(),
	}
	eng := newLoginLoadUser(tc.G, input)
	m := NewMetaContextForTest(tc).WithUIs(uis).WithNewProvisionalLoginContext()
	if err := RunEngine2(m, eng); err != nil {
		return nil, err
	}
	return eng.User(), nil
}
