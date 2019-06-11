// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
	context "golang.org/x/net/context"
)

type signupAPIMock struct {
	*libkb.NullMockAPI
	t       *testing.T
	realAPI libkb.API

	localTimeoutKeyMulti bool
	failEverything       bool
}

func (n *signupAPIMock) Post(m libkb.MetaContext, args libkb.APIArg) (*libkb.APIRes, error) {
	fmt.Printf("Post: %s\n", args.Endpoint)
	return n.realAPI.Post(m, args)
}

func (n *signupAPIMock) PostJSON(m libkb.MetaContext, args libkb.APIArg) (*libkb.APIRes, error) {
	fmt.Printf("PostJSON: %s\n", args.Endpoint)
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

func TestSignupFailProvision(t *testing.T) {
	tc := SetupEngineTest(t, "signup")
	//defer tc.Cleanup()

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
	// through but the response will not get back to us. But our device keys
	// should have been stored, so we should be good to go after we log back in
	// afterwards.
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

	// Restore real API access.
	tc.G.API = fakeAPI.realAPI

	t.Logf("Trying to login after failed signup")
	fu.LoginOrBust(tc)

	// Try to post a link to see if things work.
	_, _, err = runTrack(tc, fu, "t_alice", libkb.GetDefaultSigVersion(tc.G))
	require.NoError(t, err)
}
