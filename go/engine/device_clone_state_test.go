// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"encoding/hex"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func persistDeviceCloneState(m libkb.MetaContext, d libkb.DeviceCloneState) error {
	return libkb.SetDeviceCloneState(m, d)
}

func runAndGetDeviceCloneState(m libkb.MetaContext) (d libkb.DeviceCloneState, err error) {
	_, _, err = libkb.UpdateDeviceCloneState(m)
	if err != nil {
		return d, err
	}
	d, _ = libkb.GetDeviceCloneState(m)
	return d, err
}

func assertIsValidToken(tc libkb.TestContext, token string) {
	_, err := hex.DecodeString(token)
	require.NoError(tc.T, err)
	require.Len(tc.T, token, 32)
}

func assertSuccessfulRun(tc libkb.TestContext, d libkb.DeviceCloneState, err error) {
	require.NoError(tc.T, err)
	require.Empty(tc.T, d.Stage)
	assertIsValidToken(tc, d.Prior)
}

func TestDeviceCloneStateFirstRun(t *testing.T) {
	tc := SetupEngineTest(t, "DeviceCloneState")
	defer tc.Cleanup()
	_ = CreateAndSignupFakeUser(tc, "fu")
	m := NewMetaContextForTest(tc)

	d, err := runAndGetDeviceCloneState(m)
	assertSuccessfulRun(tc, d, err)
	require.Equal(tc.T, 1, d.Clones)
}

func TestDeviceCloneStateSuccessfulUpdate(t *testing.T) {
	tc := SetupEngineTest(t, "DeviceCloneState")
	defer tc.Cleanup()
	_ = CreateAndSignupFakeUser(tc, "fu")
	m := NewMetaContextForTest(tc)
	// setup: perform an initial run
	d0, err := runAndGetDeviceCloneState(m)
	require.NoError(tc.T, err)

	d, err := runAndGetDeviceCloneState(m)
	assertSuccessfulRun(tc, d, err)
	require.NotEqual(tc.T, d.Prior, d0.Prior)
	require.Equal(tc.T, 1, d.Clones)
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
	err := persistDeviceCloneState(m, d0)
	require.NoError(t, err)

	d, err := runAndGetDeviceCloneState(m)
	assertSuccessfulRun(tc, d, err)
	require.Equal(tc.T, d.Prior, d0.Stage)
	require.Equal(tc.T, 1, d.Clones)
}

func TestDeviceCloneStateRecoveryFromFailureAfterServer(t *testing.T) {
	tc := SetupEngineTest(t, "DeviceCloneState")
	defer tc.Cleanup()
	_ = CreateAndSignupFakeUser(tc, "fu")
	m := NewMetaContextForTest(tc)
	// setup: run twice. then reset the persistence to where it would have been
	// if the server got the second update but did not ack it successfully to the client.
	d0, err := runAndGetDeviceCloneState(m)
	require.NoError(t, err)
	d1, err := runAndGetDeviceCloneState(m)
	require.NoError(t, err)
	tmp := libkb.DeviceCloneState{Prior: d0.Prior, Stage: d1.Prior, Clones: 1}
	err = persistDeviceCloneState(m, tmp)
	require.NoError(t, err)

	d, err := runAndGetDeviceCloneState(m)
	assertSuccessfulRun(tc, d, err)
	require.Equal(tc.T, d.Prior, d1.Prior)
	require.Equal(tc.T, 1, d.Clones)
}

func TestDeviceCloneStateCloneDetected(t *testing.T) {
	tc := SetupEngineTest(t, "DeviceCloneState")
	defer tc.Cleanup()
	_ = CreateAndSignupFakeUser(tc, "fu")
	m := NewMetaContextForTest(tc)
	// setup: perform two runs, and then manually persist the earlier
	// prior token to simulate a subsequent run by a cloned device
	d0, err := runAndGetDeviceCloneState(m)
	require.NoError(tc.T, err)
	_, err = runAndGetDeviceCloneState(m)
	require.NoError(tc.T, err)
	err = persistDeviceCloneState(m, d0)
	require.NoError(t, err)

	before, after, err := libkb.UpdateDeviceCloneState(m)
	require.NoError(t, err)

	d, err := libkb.GetDeviceCloneState(m)
	assertSuccessfulRun(tc, d, err)
	require.NotEqual(tc.T, d.Prior, d0.Stage, "despite there being a clone, the prior still needs to change")
	require.Equal(tc.T, 2, d.Clones)
	require.Equal(tc.T, 1, before, "there was one clone before the test run")
	require.Equal(tc.T, 2, after, "there were two clones after the test run")
}

func TestDeviceCloneStateBeforeAndAfterOnFirstRun(t *testing.T) {
	tc := SetupEngineTest(t, "DeviceCloneState")
	defer tc.Cleanup()
	_ = CreateAndSignupFakeUser(tc, "fu")
	m := NewMetaContextForTest(tc)

	before, after, err := libkb.UpdateDeviceCloneState(m)
	require.NoError(tc.T, err)
	require.Equal(tc.T, 1, before, "there was one clone before the test run")
	require.Equal(tc.T, 1, after, "there was one clone after the test run")
}
