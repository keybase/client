// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"encoding/hex"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func persistState(m *libkb.MetaContext, d libkb.DeviceCloneState) error {
	return libkb.SetDeviceCloneState(m, d)
}

func isValidToken(token string) bool {
	_, err := hex.DecodeString(token)
	return err == nil && len(token) == 32
}

func runAndGet(m *libkb.MetaContext) (d libkb.DeviceCloneState, err error) {
	_, _, err = libkb.UpdateDeviceCloneState(m)
	d = libkb.GetDeviceCloneState(m)
	return
}

func assertSuccessfulRun(tc libkb.TestContext, d libkb.DeviceCloneState, err error) {
	require.NoError(tc.T, err)
	require.Equal(tc.T, d.Stage, "")
	require.True(tc.T, isValidToken(d.Prior))
}

func TestDeviceCloneStateFirstRun(t *testing.T) {
	tc := SetupEngineTest(t, "DeviceCloneState")
	defer tc.Cleanup()
	_ = CreateAndSignupFakeUser(tc, "fu")
	m := NewMetaContextForTest(tc)

	d, err := runAndGet(&m)

	assertSuccessfulRun(tc, d, err)
	require.Equal(tc.T, d.Clones, 1)
}

func TestDeviceCloneStateSuccessfulUpdate(t *testing.T) {
	tc := SetupEngineTest(t, "DeviceCloneState")
	defer tc.Cleanup()
	_ = CreateAndSignupFakeUser(tc, "fu")
	m := NewMetaContextForTest(tc)
	//setup: perform an initial run
	d0, err := runAndGet(&m)
	require.NoError(tc.T, err)

	d, err := runAndGet(&m)

	assertSuccessfulRun(tc, d, err)
	require.NotEqual(tc.T, d.Prior, d0.Prior)
	require.Equal(tc.T, d.Clones, 1)
}

func TestDeviceCloneStateRecoveryFromFailureBeforeServer(t *testing.T) {
	tc := SetupEngineTest(t, "DeviceCloneState")
	defer tc.Cleanup()
	_ = CreateAndSignupFakeUser(tc, "fu")
	m := NewMetaContextForTest(tc)
	// setup: persist tokens as if the process failed
	// before the server received the update
	d0 := libkb.DeviceCloneState{
		Prior:  libkb.DefaultCloneTokenValue,
		Stage:  "22222222222222222222222222222222",
		Clones: 1,
	}
	persistState(&m, d0)

	d, err := runAndGet(&m)

	assertSuccessfulRun(tc, d, err)
	require.Equal(tc.T, d.Prior, d0.Stage)
	require.Equal(tc.T, d.Clones, 1)
}

func TestDeviceCloneStateRecoveryFromFailureAfterServer(t *testing.T) {
	tc := SetupEngineTest(t, "DeviceCloneState")
	defer tc.Cleanup()
	_ = CreateAndSignupFakeUser(tc, "fu")
	m := NewMetaContextForTest(tc)
	// setup: run twice. then reset the persistence to where it would have been
	// if the server got the second update but did not ack it successfully to the client.
	d0, err := runAndGet(&m)
	d1, err := runAndGet(&m)
	tmp := libkb.DeviceCloneState{Prior: d0.Prior, Stage: d1.Prior, Clones: 1}
	persistState(&m, tmp)

	d, err := runAndGet(&m)

	assertSuccessfulRun(tc, d, err)
	require.Equal(tc.T, d.Prior, d1.Prior)
	require.Equal(tc.T, d.Clones, 1)
}

func TestDeviceCloneStateCloneDetected(t *testing.T) {
	tc := SetupEngineTest(t, "DeviceCloneState")
	defer tc.Cleanup()
	_ = CreateAndSignupFakeUser(tc, "fu")
	m := NewMetaContextForTest(tc)
	// setup: perform two runs, and then manually persist the earlier
	// prior token to simulate a subsequent run by a cloned device
	d0, err := runAndGet(&m)
	require.NoError(tc.T, err)
	_, err = runAndGet(&m)
	require.NoError(tc.T, err)
	persistState(&m, d0)

	before, after, err := libkb.UpdateDeviceCloneState(&m)
	d := libkb.GetDeviceCloneState(&m)

	assertSuccessfulRun(tc, d, err)
	require.NotEqual(tc.T, d.Prior, d0.Stage, "despite there being a clone, the prior still needs to change")
	require.Equal(tc.T, d.Clones, 2)
	require.Equal(tc.T, before, 1, "there was one clone before the test run")
	require.Equal(tc.T, after, 2, "there were two clones after the test run")
}
