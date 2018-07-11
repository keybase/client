// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"encoding/hex"
	"testing"

	"github.com/keybase/client/go/libkb"
)

func getPersistedToken(m libkb.MetaContext, un libkb.NormalizedUsername) libkb.DeviceCloneToken {
	return m.G().Env.GetConfig().GetDeviceCloneToken(un)
}

func persistToken(m libkb.MetaContext, un libkb.NormalizedUsername, d libkb.DeviceCloneToken) error {
	return m.G().Env.GetConfigWriter().SetDeviceCloneToken(un, d)
}

func isValidToken(token string) bool {
	_, err := hex.DecodeString(token)
	return err == nil && len(token) == 32
}

func runAndGet(m libkb.MetaContext, un libkb.NormalizedUsername) (d libkb.DeviceCloneToken, err error) {
	eng := NewDeviceCloneTokenEngine(m.G())
	err = RunEngine2(m, eng)
	d = getPersistedToken(m, un)
	return
}

func TestDeviceCloneTokenFirstRun(t *testing.T) {
	tc := SetupEngineTest(t, "DeviceCloneTokenEngine")
	defer tc.Cleanup()
	un := libkb.NewNormalizedUsername(CreateAndSignupFakeUser(tc, "fu").Username)
	m := NewMetaContextForTest(tc)

	d, err := runAndGet(m, un)

	if err != nil {
		t.Fatal(err)
	}
	if d.Stage != "" {
		t.Errorf("expected `stage` token to be '', got %v", d.Stage)
	}
	if d.Clones != 1 {
		t.Errorf("expected `clones` to be 1, got %v", d.Clones)
	}
	if !isValidToken(d.Prior) {
		t.Errorf("expected `prior` token to be 32 hex chars, got %v", d.Prior)
	}
}

func TestDeviceCloneTokenSuccessfulUpdate(t *testing.T) {
	tc := SetupEngineTest(t, "DeviceCloneTokenEngine")
	defer tc.Cleanup()
	un := libkb.NewNormalizedUsername(CreateAndSignupFakeUser(tc, "fu").Username)
	m := NewMetaContextForTest(tc)

	//setup: perform an initial run
	d0, err := runAndGet(m, un)
	if err != nil {
		t.Fatal(err)
	}
	// actual test run
	d, err := runAndGet(m, un)

	if err != nil {
		t.Fatal(err)
	}
	if d.Stage != "" {
		t.Errorf("expected `stage` token to be '', got %v", d.Stage)
	}
	if d.Clones != 1 {
		t.Errorf("expected `clones` to be 1, got %v", d.Clones)
	}
	if d.Prior == d0.Prior {
		t.Errorf("expected `prior` token to have changed")
	}
	if !isValidToken(d.Prior) {
		t.Errorf("expected `prior` token to be 32 hex chars, got %v", d.Prior)
	}
}

func TestDeviceCloneTokenRecoveryFromFailureBeforeServer(t *testing.T) {
	tc := SetupEngineTest(t, "DeviceCloneTokenEngine")
	defer tc.Cleanup()
	un := libkb.NewNormalizedUsername(CreateAndSignupFakeUser(tc, "fu").Username)
	m := NewMetaContextForTest(tc)

	// setup: persist tokens as if the process failed
	// before the server received the update
	d0 := libkb.DeviceCloneToken{
		Prior:  libkb.DefaultCloneTokenValue,
		Stage:  "22222222222222222222222222222222",
		Clones: 1,
	}
	persistToken(m, un, d0)
	//actual test run
	d, err := runAndGet(m, un)

	if err != nil {
		t.Fatal(err)
	}
	if d.Clones != 1 {
		t.Errorf("expected `clones` to be 1, got %v", d.Clones)
	}
	if d.Stage != "" {
		t.Errorf("expected `stage` token to be '', got %v", d.Stage)
	}
	if d.Prior != d0.Stage {
		t.Errorf("expected `prior` token to be %v, got %v", d0.Stage, d.Prior)
	}
}

func TestDeviceCloneTokenRecoveryFromFailureAfterServer(t *testing.T) {
	tc := SetupEngineTest(t, "DeviceCloneTokenEngine")
	defer tc.Cleanup()
	un := libkb.NewNormalizedUsername(CreateAndSignupFakeUser(tc, "fu").Username)
	m := NewMetaContextForTest(tc)

	// setup: run twice. then reset the persistence to where it would have been
	// if the server got the second update but did not ack it successfully to the client.
	d0, err := runAndGet(m, un)
	d1, err := runAndGet(m, un)
	tmp := libkb.DeviceCloneToken{Prior: d0.Prior, Stage: d1.Prior, Clones: 1}
	persistToken(m, un, tmp)
	// actual test run
	d2, err := runAndGet(m, un)

	if err != nil {
		t.Fatal(err)
	}
	if d2.Clones != 1 {
		t.Errorf("expected `clones` to be 1, got %v", d2.Clones)
	}
	if d2.Stage != "" {
		t.Errorf("expected `stage` token to be '', got %v", d2.Stage)
	}
	if d2.Prior != d1.Prior {
		t.Errorf("expected `prior` token to be %v, got %v", d1.Prior, d2.Prior)
	}
	if !isValidToken(d2.Prior) {
		t.Errorf("expected `prior` token to be 32 hex chars, got %v", d2.Prior)
	}
}

func TestDeviceCloneTokenCloneDetected(t *testing.T) {
	tc := SetupEngineTest(t, "DeviceCloneTokenEngine")
	defer tc.Cleanup()
	un := libkb.NewNormalizedUsername(CreateAndSignupFakeUser(tc, "fu").Username)
	m := NewMetaContextForTest(tc)

	//setup: perform two runs, and then manually put
	//old tokens back in the database
	d0, err := runAndGet(m, un)
	if err != nil {
		t.Fatal(err)
	}
	_, err = runAndGet(m, un)
	if err != nil {
		t.Fatal(err)
	}
	persistToken(m, un, d0)
	// actual test run
	d, err := runAndGet(m, un)

	if d.Clones != 2 {
		t.Errorf("expected `clones` to be 2, got %v", d.Clones)
	}
	if !isValidToken(d.Prior) {
		t.Errorf("expected `prior` token to be 32 hex chars, got %v", d.Prior)
	}
	if d.Prior == d0.Stage {
		t.Errorf("expected `prior` token to be different from the previous Stage")
	}
	if d.Stage != "" {
		t.Errorf("expected `stage` token to be '', got %v", d.Stage)
	}
}
