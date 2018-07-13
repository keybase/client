// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"encoding/hex"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
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

func assertSuccessfulRun(tc libkb.TestContext, d libkb.DeviceCloneToken, err error) {
	require.NoError(tc.T, err)
	require.Equal(tc.T, d.Stage, "")
	require.True(tc.T, isValidToken(d.Prior))
}

func TestDeviceCloneTokenFirstRun(t *testing.T) {
	tc := SetupEngineTest(t, "DeviceCloneTokenEngine")
	defer tc.Cleanup()
	un := libkb.NewNormalizedUsername(CreateAndSignupFakeUser(tc, "fu").Username)
	m := NewMetaContextForTest(tc)

	d, err := runAndGet(m, un)

	assertSuccessfulRun(tc, d, err)
	require.Equal(tc.T, d.Clones, 1)
}

func TestDeviceCloneTokenSuccessfulUpdate(t *testing.T) {
	tc := SetupEngineTest(t, "DeviceCloneTokenEngine")
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

	d, err := runAndGet(m, un)

	assertSuccessfulRun(tc, d, err)
	require.Equal(tc.T, d.Prior, d0.Stage)
	require.Equal(tc.T, d.Clones, 1)
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

	d, err := runAndGet(m, un)

	assertSuccessfulRun(tc, d, err)
	require.Equal(tc.T, d.Prior, d1.Prior)
	require.Equal(tc.T, d.Clones, 1)
}

func TestDeviceCloneTokenCloneDetected(t *testing.T) {
	tc := SetupEngineTest(t, "DeviceCloneTokenEngine")
	defer tc.Cleanup()
	un := libkb.NewNormalizedUsername(CreateAndSignupFakeUser(tc, "fu").Username)
	m := NewMetaContextForTest(tc)
	// setup: perform two runs, and then manually persist the earlier
	// prior token to simulate a subsequent run by a cloned device
	d0, err := runAndGet(m, un)
	require.NoError(tc.T, err)
	_, err = runAndGet(m, un)
	require.NoError(tc.T, err)
	persistToken(m, un, d0)

	d, err := runAndGet(m, un)

	assertSuccessfulRun(tc, d, err)
	require.NotEqual(tc.T, d.Prior, d0.Stage, "despite there being a clone, the token still needs to change")
	require.Equal(tc.T, d.Clones, 2)
}
