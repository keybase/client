// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"encoding/hex"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func persistState(m libkb.MetaContext, un libkb.NormalizedUsername, d libkb.DeviceCloneState) error {
	return m.G().Env.GetConfigWriter().SetDeviceCloneState(un, d)
}

func isValidToken(token string) bool {
	_, err := hex.DecodeString(token)
	return err == nil && len(token) == 32
}

func runAndGet(m libkb.MetaContext, un libkb.NormalizedUsername) (d libkb.DeviceCloneState, err error) {
	eng := NewDeviceCloneStateEngine(m.G())
	err = RunEngine2(m, eng)
	d = m.G().Env.GetConfig().GetDeviceCloneState(un)
	return
}

func assertSuccessfulRun(tc libkb.TestContext, d libkb.DeviceCloneState, err error) {
	require.NoError(tc.T, err)
	require.Equal(tc.T, d.Stage, "")
	require.True(tc.T, isValidToken(d.Prior))
}

func TestDeviceCloneStateFirstRun(t *testing.T) {
	tc := SetupEngineTest(t, "DeviceCloneStateEngine")
	defer tc.Cleanup()
	un := libkb.NewNormalizedUsername(CreateAndSignupFakeUser(tc, "fu").Username)
	m := NewMetaContextForTest(tc)

	d, err := runAndGet(m, un)

	assertSuccessfulRun(tc, d, err)
	require.Equal(tc.T, d.Clones, 1)
}

func TestDeviceCloneStateSuccessfulUpdate(t *testing.T) {
	tc := SetupEngineTest(t, "DeviceCloneStateEngine")
	defer tc.Cleanup()
	un := libkb.NewNormalizedUsername(CreateAndSignupFakeUser(tc, "fu").Username)
	m := NewMetaContextForTest(tc)
	//setup: perform an initial run
	d0, err := runAndGet(m, un)
	require.NoError(tc.T, err)

	d, err := runAndGet(m, un)

	assertSuccessfulRun(tc, d, err)
	require.NotEqual(tc.T, d.Prior, d0.Prior)
	require.Equal(tc.T, d.Clones, 1)
}

func TestDeviceCloneStateRecoveryFromFailureBeforeServer(t *testing.T) {
	tc := SetupEngineTest(t, "DeviceCloneStateEngine")
	defer tc.Cleanup()
	un := libkb.NewNormalizedUsername(CreateAndSignupFakeUser(tc, "fu").Username)
	m := NewMetaContextForTest(tc)
	// setup: persist tokens as if the process failed
	// before the server received the update
	d0 := libkb.DeviceCloneState{
		Prior:  libkb.DefaultCloneTokenValue,
		Stage:  "22222222222222222222222222222222",
		Clones: 1,
	}
	persistState(m, un, d0)

	d, err := runAndGet(m, un)

	assertSuccessfulRun(tc, d, err)
	require.Equal(tc.T, d.Prior, d0.Stage)
	require.Equal(tc.T, d.Clones, 1)
}

func TestDeviceCloneStateRecoveryFromFailureAfterServer(t *testing.T) {
	tc := SetupEngineTest(t, "DeviceCloneStateEngine")
	defer tc.Cleanup()
	un := libkb.NewNormalizedUsername(CreateAndSignupFakeUser(tc, "fu").Username)
	m := NewMetaContextForTest(tc)
	// setup: run twice. then reset the persistence to where it would have been
	// if the server got the second update but did not ack it successfully to the client.
	d0, err := runAndGet(m, un)
	d1, err := runAndGet(m, un)
	tmp := libkb.DeviceCloneState{Prior: d0.Prior, Stage: d1.Prior, Clones: 1}
	persistState(m, un, tmp)

	d, err := runAndGet(m, un)

	assertSuccessfulRun(tc, d, err)
	require.Equal(tc.T, d.Prior, d1.Prior)
	require.Equal(tc.T, d.Clones, 1)
}

func TestDeviceCloneStateCloneDetected(t *testing.T) {
	tc := SetupEngineTest(t, "DeviceCloneStateEngine")
	defer tc.Cleanup()
	un := libkb.NewNormalizedUsername(CreateAndSignupFakeUser(tc, "fu").Username)
	m := NewMetaContextForTest(tc)
	// setup: perform two runs, and then manually persist the earlier
	// prior token to simulate a subsequent run by a cloned device
	d0, err := runAndGet(m, un)
	require.NoError(tc.T, err)
	_, err = runAndGet(m, un)
	require.NoError(tc.T, err)
	persistState(m, un, d0)

	d, err := runAndGet(m, un)

	assertSuccessfulRun(tc, d, err)
	require.NotEqual(tc.T, d.Prior, d0.Stage, "despite there being a clone, the prior still needs to change")
	require.Equal(tc.T, d.Clones, 2)
}
