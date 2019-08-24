// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	context "golang.org/x/net/context"
)

type signupAPIMock struct {
	*libkb.NullMockAPI
	t       *testing.T
	realAPI libkb.API

	failKeyMulti         bool
	localTimeoutKeyMulti bool
	failEverything       bool
}

var _ libkb.API = (*signupAPIMock)(nil)

func (n *signupAPIMock) Post(m libkb.MetaContext, args libkb.APIArg) (*libkb.APIRes, error) {
	n.t.Logf("signupAPIMock.Post: %s\n", args.Endpoint)
	return n.realAPI.Post(m, args)
}

func (n *signupAPIMock) PostJSON(m libkb.MetaContext, args libkb.APIArg) (*libkb.APIRes, error) {
	n.t.Logf("signupAPIMock.PostJSON: %s\n", args.Endpoint)
	if n.failKeyMulti && args.Endpoint == "key/multi" {
		n.failEverything = true
		n.t.Logf("Got key/multi, failing the call (not sending to real API), subsequent calls will fail as well")
		return nil, errors.New("Mock failure")
	}
	res, err := n.realAPI.PostJSON(m, args)
	if n.localTimeoutKeyMulti && args.Endpoint == "key/multi" {
		n.failEverything = true
		n.t.Logf("Got key/multi, mocking a local timeout, all subsequent API calls will fail as well.")
		return nil, errors.New("Mock local failure")
	}
	return res, err
}

func (n *signupAPIMock) Get(m libkb.MetaContext, args libkb.APIArg) (*libkb.APIRes, error) {
	if n.failEverything {
		return nil, errors.New("signupAPIMock simulated network error")
	}
	return n.realAPI.Get(m, args)
}

func (n *signupAPIMock) GetResp(m libkb.MetaContext, args libkb.APIArg) (*http.Response, func(), error) {
	if n.failEverything {
		return nil, func() {}, errors.New("signupAPIMock simulated network error")
	}
	return n.realAPI.GetResp(m, args)
}

func (n *signupAPIMock) GetDecode(m libkb.MetaContext, args libkb.APIArg, wrap libkb.APIResponseWrapper) error {
	if n.failEverything {
		return errors.New("signupAPIMock simulated network error")
	}
	return n.realAPI.GetDecode(m, args, wrap)
}

func (n *signupAPIMock) GetDecodeCtx(ctx context.Context, args libkb.APIArg, wrap libkb.APIResponseWrapper) error {
	if n.failEverything {
		return errors.New("signupAPIMock simulated network error")
	}
	return n.realAPI.GetDecodeCtx(ctx, args, wrap)
}

func nopwChangePassphrase(tc libkb.TestContext) error {
	newPassphrase := "okokokok"
	arg := &keybase1.PassphraseChangeArg{
		Passphrase: newPassphrase,
		Force:      true,
	}
	uis := libkb.UIs{
		SecretUI: &libkb.TestSecretUI{},
	}
	eng := NewPassphraseChange(tc.G, arg)
	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)
	return RunEngine2(m, eng)
}

func TestSecretStorePwhashAfterSignup(t *testing.T) {
	// Ensure there are no leftovers in secret store after normal, successful
	// signup.

	tc := SetupEngineTest(t, "signup")
	defer tc.Cleanup()

	fu := NewFakeUserOrBust(tc.T, "su")
	arg := MakeTestSignupEngineRunArg(fu)
	arg.GenerateRandomPassphrase = true
	arg.Passphrase = ""
	arg.StoreSecret = true
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	eng := NewSignupEngine(tc.G, &arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
	require.NoError(t, err)

	ss := tc.G.SecretStore()
	mctx := libkb.NewMetaContextForTest(tc)
	a, err1 := ss.RetrieveSecret(mctx, libkb.NormalizedUsername(fmt.Sprintf("%s.tmp_eddsa", fu.Username)))
	b, err2 := ss.RetrieveSecret(mctx, libkb.NormalizedUsername(fmt.Sprintf("%s.tmp_pwhash", fu.Username)))
	require.True(t, a.IsNil())
	require.True(t, b.IsNil())
	require.Error(t, err1)
	require.Error(t, err2)
}

func TestSignupFailProvision(t *testing.T) {
	// Test recovery after NOPW SignupJoin succeeds but we fail to provision.
	tc := SetupEngineTest(t, "signup")
	defer tc.Cleanup()

	fakeAPI := &signupAPIMock{t: t, realAPI: tc.G.API}
	tc.G.API = fakeAPI
	fakeAPI.failKeyMulti = true

	fu := NewFakeUserOrBust(tc.T, "su")
	tc.G.Log.Debug("New test user: %s / %s", fu.Username, fu.Email)
	arg := MakeTestSignupEngineRunArg(fu)
	arg.GenerateRandomPassphrase = true
	arg.Passphrase = ""
	arg.StoreSecret = true
	fu.DeviceName = arg.DeviceName

	// Try to sign up - we will fail because our key/multi request for
	// provisioning will not go through. We should be able to login+provision
	// afterwards with stored passphrase stream.
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	s := NewSignupEngine(tc.G, &arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, s)
	// We are expecting an error during signup.
	require.Error(tc.T, err)
	require.Contains(t, err.Error(), "Mock failure")
	fu.EncryptionKey = s.encryptionKey

	t.Logf("Signup failed with: %s", err)
	require.True(t, fakeAPI.failEverything)

	checkStoredPw := func() (foundA, foundB bool, err error) {
		ss := tc.G.SecretStore()
		mctx := libkb.NewMetaContextForTest(tc)
		a, err1 := ss.RetrieveSecret(mctx, libkb.NormalizedUsername(fmt.Sprintf("%s.tmp_eddsa", fu.Username)))
		b, err2 := ss.RetrieveSecret(mctx, libkb.NormalizedUsername(fmt.Sprintf("%s.tmp_pwhash", fu.Username)))
		return !a.IsNil(), !b.IsNil(), libkb.CombineErrors(err1, err2)
	}

	// We expect to see stored eddsa and pwhash after signup.
	foundA, foundB, err := checkStoredPw()
	require.NoError(t, err)
	require.True(t, foundA && foundB)

	// We do not expect to see them in GetUsersWithStoredSecrets
	users, err := tc.G.GetUsersWithStoredSecrets(context.Background())
	require.NoError(t, err)
	require.Empty(t, users)

	// Restore real API access.
	tc.G.API = fakeAPI.realAPI

	t.Logf("Trying to login after failed signup")
	err = fu.Login(tc.G)
	require.NoError(t, err) // This will not work - user has already devices provisioned, no way to recover.

	// After signing up, we expect pw secret store entries to be cleared up.
	foundA, foundB, err = checkStoredPw()
	require.Error(t, err)
	require.True(t, !foundA && !foundB)

	// Try to post a link to see if things work.
	_, _, err = runTrack(tc, fu, "t_alice", libkb.GetDefaultSigVersion(tc.G))
	require.NoError(t, err)

	// See if user can set passphrase
	err = nopwChangePassphrase(tc)
	require.NoError(t, err)

	{
		eng := NewPassphraseCheck(tc.G, &keybase1.PassphraseCheckArg{
			Passphrase: "okokokok",
		})
		err := RunEngine2(m, eng)
		require.NoError(t, err)
	}
}

func TestSignupFailAfterProvision(t *testing.T) {
	tc := SetupEngineTest(t, "signup")
	defer tc.Cleanup()

	fakeAPI := &signupAPIMock{t: t, realAPI: tc.G.API}
	tc.G.API = fakeAPI
	fakeAPI.localTimeoutKeyMulti = true

	fu := NewFakeUserOrBust(tc.T, "su")
	tc.G.Log.Debug("New test user: %s / %s", fu.Username, fu.Email)
	arg := MakeTestSignupEngineRunArg(fu)
	arg.GenerateRandomPassphrase = true
	arg.Passphrase = ""
	arg.StoreSecret = true
	fu.DeviceName = arg.DeviceName

	// Try to sign up - we will fail because our provisioning request will go
	// through but the response will not get back to us. So we are provisioned,
	// but our device does not know about this.
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	s := NewSignupEngine(tc.G, &arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, s)
	// We are expecting an error during signup.
	require.Error(tc.T, err)
	require.Contains(t, err.Error(), "Mock local failure")
	fu.EncryptionKey = s.encryptionKey

	t.Logf("Signup failed with: %s", err)
	require.True(t, fakeAPI.failEverything)

	checkStoredPw := func() (foundA, foundB bool, err error) {
		ss := tc.G.SecretStore()
		mctx := libkb.NewMetaContextForTest(tc)
		a, err1 := ss.RetrieveSecret(mctx, libkb.NormalizedUsername(fmt.Sprintf("%s.tmp_eddsa", fu.Username)))
		b, err2 := ss.RetrieveSecret(mctx, libkb.NormalizedUsername(fmt.Sprintf("%s.tmp_pwhash", fu.Username)))
		return !a.IsNil(), !b.IsNil(), libkb.CombineErrors(err1, err2)
	}

	// We expect to see stored eddsa and pwhash after signup.
	foundA, foundB, err := checkStoredPw()
	require.NoError(t, err)
	require.True(t, foundA && foundB)

	// Restore real API access.
	tc.G.API = fakeAPI.realAPI

	t.Logf("Trying to login after failed signup")
	// This will not work - user has already devices provisioned, no way to recover.
	// There is another ticket to make this work using stored secrets.
	err = fu.Login(tc.G)
	require.Error(t, err)
	require.Contains(t, err.Error(), "Provision unavailable as you don't have access to any of your devices")
}
