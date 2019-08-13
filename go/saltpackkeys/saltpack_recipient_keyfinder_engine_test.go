// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.
package saltpackkeys

import (
	"bytes"
	"context"
	"encoding/hex"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	insecureTriplesec "github.com/keybase/go-triplesec-insecure"
)

func InstallInsecureTriplesec(g *libkb.GlobalContext) {
	g.NewTriplesec = func(passphrase []byte, salt []byte) (libkb.Triplesec, error) {
		warner := func() { g.Log.Warning("Installing insecure Triplesec with weak stretch parameters") }
		isProduction := func() bool {
			return g.Env.GetRunMode() == libkb.ProductionRunMode
		}
		return insecureTriplesec.NewCipher(passphrase, salt, libkb.ClientTriplesecVersion, warner, isProduction)
	}
}

func SetupKeyfinderEngineTest(tb libkb.TestingTB, name string) (tc libkb.TestContext) {
	// SetupTest ignores the depth argument, so we can safely pass 0.
	tc = externalstest.SetupTest(tb, name, 0)

	// use an insecure triplesec in tests
	InstallInsecureTriplesec(tc.G)

	return tc

}

func TestSaltpackRecipientKeyfinderPUKs(t *testing.T) {
	tc := SetupKeyfinderEngineTest(t, "SaltpackRecipientKeyfinderEngine")
	defer tc.Cleanup()

	u1, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)
	u2, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)
	u3, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)

	trackUI := &kbtest.FakeIdentifyUI{
		Proofs: make(map[string]string),
	}

	uis := libkb.UIs{IdentifyUI: trackUI, SecretUI: u3.NewSecretUI()}
	arg := libkb.SaltpackRecipientKeyfinderArg{
		Recipients:    []string{u1.Username, u2.Username, u3.Username},
		UseEntityKeys: true,
		// Since no user has a paper key, this option should not lead to the addition of any keys.
		UsePaperKeys: true,
	}
	eng := NewSaltpackRecipientKeyfinderEngineAsInterfaceForTesting(arg)
	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)
	if err := engine.RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	fDHKeys := eng.GetPublicKIDs()
	if len(fDHKeys) != 3 {
		t.Errorf("number of per user keys found: %d, expected 3", len(fDHKeys))
	}
	fDHKeyset := make(map[keybase1.KID]struct{})
	for _, fPUK := range fDHKeys {
		fDHKeyset[fPUK] = struct{}{}
	}
	KID := u1.User.GetComputedKeyFamily().GetLatestPerUserKey().EncKID
	if _, ok := fDHKeyset[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}
	KID = u2.User.GetComputedKeyFamily().GetLatestPerUserKey().EncKID
	if _, ok := fDHKeyset[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}
	KID = u3.User.GetComputedKeyFamily().GetLatestPerUserKey().EncKID
	if _, ok := fDHKeyset[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}

	symKeys := eng.GetSymmetricKeys()
	if len(symKeys) != 0 {
		t.Errorf("number of symmetric keys found: %d, expected 0", len(symKeys))
	}

}

func TestSaltpackRecipientKeyfinderFailsOnNonExistingUserWithoutLogin(t *testing.T) {
	tc := SetupKeyfinderEngineTest(t, "SaltpackRecipientKeyfinderEngine")
	defer tc.Cleanup()

	u3, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)
	kbtest.Logout(tc)

	trackUI := &kbtest.FakeIdentifyUI{
		Proofs: make(map[string]string),
	}

	uis := libkb.UIs{IdentifyUI: trackUI, SecretUI: u3.NewSecretUI()}
	arg := libkb.SaltpackRecipientKeyfinderArg{
		Recipients:    []string{"not_a_user"},
		UseEntityKeys: true,
		NoSelfEncrypt: true,
	}
	eng := NewSaltpackRecipientKeyfinderEngineAsInterfaceForTesting(arg)
	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)
	err = engine.RunEngine2(m, eng)
	_, ok := engine.RunEngine2(m, eng).(libkb.RecipientNotFoundError)
	require.True(t, ok, err.Error())
}

func TestSaltpackRecipientKeyfinderFailsOnNonExistingUserWithLogin(t *testing.T) {
	tc := SetupKeyfinderEngineTest(t, "SaltpackRecipientKeyfinderEngine")
	defer tc.Cleanup()

	u3, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)

	trackUI := &kbtest.FakeIdentifyUI{
		Proofs: make(map[string]string),
	}

	uis := libkb.UIs{IdentifyUI: trackUI, SecretUI: u3.NewSecretUI()}
	arg := libkb.SaltpackRecipientKeyfinderArg{
		Recipients:    []string{"not_a_user"},
		UseEntityKeys: true,
	}
	eng := NewSaltpackRecipientKeyfinderEngineAsInterfaceForTesting(arg)
	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)
	err = engine.RunEngine2(m, eng)
	_, ok := engine.RunEngine2(m, eng).(libkb.RecipientNotFoundError)
	require.True(t, ok, err.Error())
}

func TestSaltpackRecipientKeyfinderPUKSelfEncrypt(t *testing.T) {
	tc := SetupKeyfinderEngineTest(t, "SaltpackRecipientKeyfinderEngine")
	defer tc.Cleanup()

	u1, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)
	u2, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)
	u3, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)

	trackUI := &kbtest.FakeIdentifyUI{
		Proofs: make(map[string]string),
	}

	uis := libkb.UIs{IdentifyUI: trackUI, SecretUI: u3.NewSecretUI()}
	arg := libkb.SaltpackRecipientKeyfinderArg{
		Recipients:    []string{u1.Username, u2.Username},
		UseEntityKeys: true,
	}
	eng := NewSaltpackRecipientKeyfinderEngineAsInterfaceForTesting(arg)
	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)
	if err := engine.RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	fDHKeys := eng.GetPublicKIDs()
	if len(fDHKeys) != 3 {
		t.Errorf("number of per user keys found: %d, expected 3", len(fDHKeys))
	}
	fDHKeyset := make(map[keybase1.KID]struct{})
	for _, fPUK := range fDHKeys {
		fDHKeyset[fPUK] = struct{}{}
	}
	KID := u1.User.GetComputedKeyFamily().GetLatestPerUserKey().EncKID
	if _, ok := fDHKeyset[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}
	KID = u2.User.GetComputedKeyFamily().GetLatestPerUserKey().EncKID
	if _, ok := fDHKeyset[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}
	KID = u3.User.GetComputedKeyFamily().GetLatestPerUserKey().EncKID
	if _, ok := fDHKeyset[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}

	symKeys := eng.GetSymmetricKeys()
	if len(symKeys) != 0 {
		t.Errorf("number of symmetric keys found: %d, expected 0", len(symKeys))
	}

}

func TestSaltpackRecipientKeyfinderPUKNoSelfEncrypt(t *testing.T) {
	tc := SetupKeyfinderEngineTest(t, "SaltpackRecipientKeyfinderEngine")
	defer tc.Cleanup()

	u1, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)
	u2, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)
	u3, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)

	trackUI := &kbtest.FakeIdentifyUI{
		Proofs: make(map[string]string),
	}

	uis := libkb.UIs{IdentifyUI: trackUI, SecretUI: u3.NewSecretUI()}
	arg := libkb.SaltpackRecipientKeyfinderArg{
		Recipients:    []string{u1.Username, u2.Username},
		UseEntityKeys: true,
		NoSelfEncrypt: true, // Since this is set, u3's keys should NOT be included.
	}
	eng := NewSaltpackRecipientKeyfinderEngineAsInterfaceForTesting(arg)
	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)
	if err := engine.RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	fDHKeys := eng.GetPublicKIDs()
	if len(fDHKeys) != 2 {
		t.Errorf("number of per user keys found: %d, expected 2", len(fDHKeys))
	}
	fDHKeyset := make(map[keybase1.KID]struct{})
	for _, fPUK := range fDHKeys {
		fDHKeyset[fPUK] = struct{}{}
	}
	KID := u1.User.GetComputedKeyFamily().GetLatestPerUserKey().EncKID
	if _, ok := fDHKeyset[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}
	KID = u2.User.GetComputedKeyFamily().GetLatestPerUserKey().EncKID
	if _, ok := fDHKeyset[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}

	symKeys := eng.GetSymmetricKeys()
	if len(symKeys) != 0 {
		t.Errorf("number of symmetric keys found: %d, expected 0", len(symKeys))
	}

}

func TestSaltpackRecipientKeyfinderCreatesImplicitTeamIfUserHasNoPUK(t *testing.T) {
	tc := SetupKeyfinderEngineTest(t, "SaltpackRecipientKeyfinderEngine")
	defer tc.Cleanup()
	teams.ServiceInit(tc.G)

	u1, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)
	u2, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)

	trackUI := &kbtest.FakeIdentifyUI{
		Proofs: make(map[string]string),
	}

	uis := libkb.UIs{IdentifyUI: trackUI, SecretUI: u2.NewSecretUI()}
	arg := libkb.SaltpackRecipientKeyfinderArg{
		Recipients:    []string{u1.Username},
		UseEntityKeys: true,
	}
	eng := NewSaltpackRecipientKeyfinderEngineAsInterfaceForTesting(arg)
	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)

	// This should work with no errors, as both users exist and have PUKs
	if err := engine.RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}
	fDHKeys := eng.GetPublicKIDs()
	if len(fDHKeys) != 2 {
		t.Errorf("number of per user keys found: %d, expected 2", len(fDHKeys))
	}
	fDHKeyset := make(map[keybase1.KID]struct{})
	for _, fPUK := range fDHKeys {
		fDHKeyset[fPUK] = struct{}{}
	}
	KID := u1.User.GetComputedKeyFamily().GetLatestPerUserKey().EncKID
	if _, ok := fDHKeyset[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}
	KID = u2.User.GetComputedKeyFamily().GetLatestPerUserKey().EncKID
	if _, ok := fDHKeyset[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}

	require.Empty(t, eng.GetSymmetricKeys())

	// Now, let's create a user without PUK
	tc.Tp.DisableUpgradePerUserKey = true
	u3, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)
	kbtest.Logout(tc)

	u2.Login(tc.G)

	// This should create an implicit team, as u3 has no PUK
	arg = libkb.SaltpackRecipientKeyfinderArg{
		Recipients:    []string{u1.Username, u3.Username},
		UseEntityKeys: true,
	}
	eng = NewSaltpackRecipientKeyfinderEngineAsInterfaceForTesting(arg)
	err = engine.RunEngine2(m, eng)
	require.NoError(t, err)
	fDHKeys = eng.GetPublicKIDs()
	if len(fDHKeys) != 2 {
		t.Errorf("number of per user keys found: %d, expected 2", len(fDHKeys))
	}
	fDHKeyset = make(map[keybase1.KID]struct{})
	for _, fPUK := range fDHKeys {
		fDHKeyset[fPUK] = struct{}{}
	}
	KID = u1.User.GetComputedKeyFamily().GetLatestPerUserKey().EncKID
	if _, ok := fDHKeyset[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}
	KID = u2.User.GetComputedKeyFamily().GetLatestPerUserKey().EncKID
	if _, ok := fDHKeyset[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}

	symKeys := eng.GetSymmetricKeys()
	require.Len(t, symKeys, 1)
	team, _, _, err := teams.LookupImplicitTeam(m.Ctx(), m.G(), u2.Username+","+u3.Username, false, teams.ImplicitTeamOptions{})
	require.NoError(t, err)
	teamSaltpackKey, err := team.SaltpackEncryptionKeyLatest(m.Ctx())
	require.NoError(t, err)
	require.True(t, bytes.Equal(teamSaltpackKey.Key[:], symKeys[0].Key[:]))
}

func TestSaltpackRecipientKeyfinderDeviceKeys(t *testing.T) {
	tc := SetupKeyfinderEngineTest(t, "SaltpackRecipientKeyfinderEngine")
	defer tc.Cleanup()

	u1, err := kbtest.CreateAndSignupFakeUserPaper("spkfe", tc.G)
	require.NoError(t, err)

	// u2 has 2 devices
	u2, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)
	tcY := SetupKeyfinderEngineTest(t, "SaltpackRecipientKeyfinderEngine2") // context for second device
	defer tcY.Cleanup()
	kbtest.ProvisionNewDeviceKex(&tc, &tcY, u2, libkb.DeviceTypeDesktop)
	m := libkb.NewMetaContextForTest(tc)
	tc.G.BustLocalUserCache(m.Ctx(), u2.GetUID())
	tc.G.GetUPAKLoader().ClearMemory()
	u2new, err := libkb.LoadMe(libkb.NewLoadUserArgWithMetaContext(m))
	require.NoError(t, err)

	u3, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)

	trackUI := &kbtest.FakeIdentifyUI{
		Proofs: make(map[string]string),
	}

	uis := libkb.UIs{IdentifyUI: trackUI, SecretUI: u3.NewSecretUI()}
	arg := libkb.SaltpackRecipientKeyfinderArg{
		Recipients:    []string{u1.Username, u2.Username, u3.Username},
		UseDeviceKeys: true,
	}
	eng := NewSaltpackRecipientKeyfinderEngineAsInterfaceForTesting(arg)
	m = m.WithUIs(uis)
	if err := engine.RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	fDHKeys := eng.GetPublicKIDs()
	if len(fDHKeys) != 4 {
		t.Errorf("number of device keys found: %d, expected 4", len(fDHKeys))
	}
	fDHKeyset := make(map[keybase1.KID]struct{})
	for _, fPUK := range fDHKeys {
		fDHKeyset[fPUK] = struct{}{}
	}

	u1Device, err := selectOneActiveNonPaperDeviceID(u1.User)
	require.NoError(t, err)
	key, err := u1.User.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(u1Device)
	require.NoError(t, err)
	KID := key.GetKID()
	if _, ok := fDHKeyset[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}
	key, err = u2new.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(u2new.GetComputedKeyFamily().GetAllActiveDevices()[0].ID)
	require.NoError(t, err)
	KID = key.GetKID()
	if _, ok := fDHKeyset[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}
	key, err = u2new.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(u2new.GetComputedKeyFamily().GetAllActiveDevices()[1].ID)
	require.NoError(t, err)
	KID = key.GetKID()
	if _, ok := fDHKeyset[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}
	key, err = u3.User.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(u3.User.GetComputedKeyFamily().GetAllActiveDevices()[0].ID)
	require.NoError(t, err)
	KID = key.GetKID()
	if _, ok := fDHKeyset[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}

	symKeys := eng.GetSymmetricKeys()
	if len(symKeys) != 0 {
		t.Errorf("number of symmetric keys found: %d, expected 0", len(symKeys))
	}

}

func TestSaltpackRecipientKeyfinderSkipsMissingKeys(t *testing.T) {
	tc := SetupKeyfinderEngineTest(t, "SaltpackRecipientKeyfinderEngine")
	defer tc.Cleanup()

	u1, err := kbtest.CreateAndSignupFakeUserPaper("spkfe", tc.G)
	require.NoError(t, err)
	u2, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)
	u3, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)

	trackUI := &kbtest.FakeIdentifyUI{
		Proofs: make(map[string]string),
	}

	uis := libkb.UIs{IdentifyUI: trackUI, SecretUI: u3.NewSecretUI()}
	arg := libkb.SaltpackRecipientKeyfinderArg{
		Recipients:    []string{u1.Username, u2.Username, u3.Username},
		UseDeviceKeys: true,
		UsePaperKeys:  true, // only u1 has a paper key
	}
	eng := NewSaltpackRecipientKeyfinderEngineAsInterfaceForTesting(arg)
	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)
	if err := engine.RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	fDHKeys := eng.GetPublicKIDs()
	if len(fDHKeys) != 4 {
		t.Errorf("number of device keys found: %d, expected 4", len(fDHKeys))
	}
	fDHKeyset := make(map[keybase1.KID]struct{})
	for _, fPUK := range fDHKeys {
		fDHKeyset[fPUK] = struct{}{}
	}

	key, err := u1.User.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(u1.User.GetComputedKeyFamily().GetAllActiveDevices()[0].ID)
	require.NoError(t, err)
	KID := key.GetKID()
	if _, ok := fDHKeyset[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}
	key, err = u1.User.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(u1.User.GetComputedKeyFamily().GetAllActiveDevices()[1].ID)
	require.NoError(t, err)
	KID = key.GetKID()
	if _, ok := fDHKeyset[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}
	key, err = u2.User.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(u2.User.GetComputedKeyFamily().GetAllActiveDevices()[0].ID)
	require.NoError(t, err)
	KID = key.GetKID()
	if _, ok := fDHKeyset[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}
	key, err = u3.User.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(u3.User.GetComputedKeyFamily().GetAllActiveDevices()[0].ID)
	require.NoError(t, err)
	KID = key.GetKID()
	if _, ok := fDHKeyset[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}

	symKeys := eng.GetSymmetricKeys()
	if len(symKeys) != 0 {
		t.Errorf("number of symmetric keys found: %d, expected 0", len(symKeys))
	}

}

func selectOneActivePaperDeviceID(u *libkb.User) (keybase1.DeviceID, error) {
	for _, d := range u.GetComputedKeyFamily().GetAllActiveDevices() {
		if d.Type == libkb.DeviceTypePaper {
			return d.ID, nil
		}
	}
	return "", fmt.Errorf("No paper devices found")
}

func selectOneActiveNonPaperDeviceID(u *libkb.User) (keybase1.DeviceID, error) {
	for _, d := range u.GetComputedKeyFamily().GetAllActiveDevices() {
		if d.Type != libkb.DeviceTypePaper {
			return d.ID, nil
		}
	}
	return "", fmt.Errorf("No paper devices found")
}

func TestSaltpackRecipientKeyfinderPaperKeys(t *testing.T) {
	tc := SetupKeyfinderEngineTest(t, "SaltpackRecipientKeyfinderEngine")
	defer tc.Cleanup()

	u1, err := kbtest.CreateAndSignupFakeUserPaper("spkfe", tc.G)
	require.NoError(t, err)
	u2, err := kbtest.CreateAndSignupFakeUserPaper("spkfe", tc.G)
	require.NoError(t, err)
	u3, err := kbtest.CreateAndSignupFakeUserPaper("spkfe", tc.G)
	require.NoError(t, err)

	trackUI := &kbtest.FakeIdentifyUI{
		Proofs: make(map[string]string),
	}

	uis := libkb.UIs{IdentifyUI: trackUI, SecretUI: u3.NewSecretUI()}
	arg := libkb.SaltpackRecipientKeyfinderArg{
		Recipients:   []string{u1.Username, u2.Username, u3.Username},
		UsePaperKeys: true,
	}
	eng := NewSaltpackRecipientKeyfinderEngineAsInterfaceForTesting(arg)
	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)
	if err := engine.RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	fDHKeys := eng.GetPublicKIDs()
	if len(fDHKeys) != 3 {
		t.Errorf("number of device keys found: %d, expected 3", len(fDHKeys))
	}
	fDHKeyset := make(map[keybase1.KID]struct{})
	for _, fPUK := range fDHKeys {
		fDHKeyset[fPUK] = struct{}{}
	}

	id, err := selectOneActivePaperDeviceID(u1.User)
	require.NoError(t, err)
	key, err := u1.User.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(id)
	require.NoError(t, err)
	KID := key.GetKID()
	if _, ok := fDHKeyset[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}
	id, err = selectOneActivePaperDeviceID(u1.User)
	require.NoError(t, err)
	key, err = u1.User.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(id)
	require.NoError(t, err)
	KID = key.GetKID()
	if _, ok := fDHKeyset[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}
	id, err = selectOneActivePaperDeviceID(u1.User)
	require.NoError(t, err)
	key, err = u1.User.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(id)
	require.NoError(t, err)
	KID = key.GetKID()
	if _, ok := fDHKeyset[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}

	symKeys := eng.GetSymmetricKeys()
	if len(symKeys) != 0 {
		t.Errorf("number of symmetric keys found: %d, expected 0", len(symKeys))
	}
}

func TestSaltpackRecipientKeyfinderDevicePaperAndPerUserKeys(t *testing.T) {
	tc := SetupKeyfinderEngineTest(t, "SaltpackRecipientKeyfinderEngine")
	defer tc.Cleanup()

	u1, err := kbtest.CreateAndSignupFakeUserPaper("spkfe", tc.G)
	require.NoError(t, err)

	// u2 has 2 devices + 1 paper device
	u2, err := kbtest.CreateAndSignupFakeUserPaper("spkfe", tc.G)
	require.NoError(t, err)
	tcY := SetupKeyfinderEngineTest(t, "SaltpackRecipientKeyfinderEngine2") // context for second device
	defer tcY.Cleanup()
	kbtest.ProvisionNewDeviceKex(&tc, &tcY, u2, libkb.DeviceTypeDesktop)
	m := libkb.NewMetaContextForTest(tc)
	tc.G.BustLocalUserCache(m.Ctx(), u2.GetUID())
	tc.G.GetUPAKLoader().ClearMemory()
	u2new, err := libkb.LoadMe(libkb.NewLoadUserArgWithMetaContext(m))
	require.NoError(t, err)

	u3, err := kbtest.CreateAndSignupFakeUserPaper("spkfe", tc.G)
	require.NoError(t, err)

	trackUI := &kbtest.FakeIdentifyUI{
		Proofs: make(map[string]string),
	}

	uis := libkb.UIs{IdentifyUI: trackUI, SecretUI: u3.NewSecretUI()}
	arg := libkb.SaltpackRecipientKeyfinderArg{
		Recipients:    []string{u1.Username, u2.Username, u3.Username},
		UseDeviceKeys: true,
		UsePaperKeys:  true,
		UseEntityKeys: true,
	}
	eng := NewSaltpackRecipientKeyfinderEngineAsInterfaceForTesting(arg)
	m = m.WithUIs(uis)
	if err := engine.RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	fDHKeys := eng.GetPublicKIDs()
	if len(fDHKeys) != 10 { // 3 keys per user (1 paper, 1 device, 1 puk), plus an extra device for u2
		t.Errorf("number of device keys found: %d, expected 4", len(fDHKeys))
	}
	fDHKeyset := make(map[keybase1.KID]struct{})
	for _, fPUK := range fDHKeys {
		fDHKeyset[fPUK] = struct{}{}
	}

	allKeyFamilies := []*libkb.ComputedKeyFamily{}
	allKeyFamilies = append(allKeyFamilies, u1.User.GetComputedKeyFamily())
	allKeyFamilies = append(allKeyFamilies, u2new.GetComputedKeyFamily())
	allKeyFamilies = append(allKeyFamilies, u3.User.GetComputedKeyFamily())

	var allKIDs []keybase1.KID
	for _, kf := range allKeyFamilies {
		for _, d := range kf.GetAllActiveDevices() {
			k, err := kf.GetEncryptionSubkeyForDevice(d.ID)
			require.NoError(t, err)
			allKIDs = append(allKIDs, k.GetKID())
		}
		allKIDs = append(allKIDs, kf.GetLatestPerUserKey().EncKID)
	}
	require.Equal(t, 10, len(allKIDs)) // 3 keys for u1 and u3 (1 paper, 1 device, 1 puk), 4 for u2 (has 2 devices)

	for _, KID := range allKIDs {
		if _, ok := fDHKeyset[KID]; !ok {
			t.Errorf("expected to find key %v, which was not retrieved", KID)
		}
	}
	symKeys := eng.GetSymmetricKeys()
	if len(symKeys) != 0 {
		t.Errorf("number of symmetric keys found: %d, expected 0", len(symKeys))
	}
}

func TestSaltpackRecipientKeyfinderExistingUserAssertions(t *testing.T) {
	tc := SetupKeyfinderEngineTest(t, "SaltpackRecipientKeyfinderEngine")
	defer tc.Cleanup()

	u1, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)

	trackUI := &kbtest.FakeIdentifyUI{
		Proofs: make(map[string]string),
	}

	uis := libkb.UIs{IdentifyUI: trackUI, SecretUI: u1.NewSecretUI()}
	arg := libkb.SaltpackRecipientKeyfinderArg{
		Recipients:    []string{"t_tracy+t_tracy@rooter", "t_george", "t_kb+gbrltest@twitter"},
		UseDeviceKeys: true,
		NoSelfEncrypt: true,
	}
	eng := NewSaltpackRecipientKeyfinderEngineAsInterfaceForTesting(arg)
	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)
	if err := engine.RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	fDHKeys := eng.GetPublicKIDs()
	if len(fDHKeys) != 6 { // t_tracy has 1 device (+ a paper key, excluded here), t_george has 2 devices and a web key, t_kb has a device and a web key.
		t.Errorf("number of DH keys found: %d, expected 6", len(fDHKeys))
	}

	symKeys := eng.GetSymmetricKeys()
	if len(symKeys) != 0 {
		t.Errorf("number of symmetric keys found: %d, expected 0", len(symKeys))
	}

}

func createTeam(tc libkb.TestContext) (keybase1.TeamID, string) {
	teams.ServiceInit(tc.G)

	b, err := libkb.RandBytes(4)
	require.NoError(tc.T, err)
	name := "t_" + hex.EncodeToString(b)
	teamID, err := teams.CreateRootTeam(context.TODO(), tc.G, name, keybase1.TeamSettings{})
	require.NoError(tc.T, err)
	require.NotNil(tc.T, teamID)

	return *teamID, name
}

func TestSaltpackRecipientKeyfinderTeam(t *testing.T) {
	tc := SetupKeyfinderEngineTest(t, "SaltpackRecipientKeyfinderEngine")
	defer tc.Cleanup()

	u1, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)
	u2, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)

	_, teamName := createTeam(tc)
	_, err = teams.AddMember(context.TODO(), tc.G, teamName, u1.Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	u3, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)

	u3.Login(tc.G)

	trackUI := &kbtest.FakeIdentifyUI{
		Proofs: make(map[string]string),
	}

	// u3 is not part of the team, keyfinding should fail.
	uis := libkb.UIs{IdentifyUI: trackUI, SecretUI: u3.NewSecretUI()}
	arg := libkb.SaltpackRecipientKeyfinderArg{
		TeamRecipients: []string{teamName},
		UseEntityKeys:  true,
	}
	eng := NewSaltpackRecipientKeyfinderEngineAsInterfaceForTesting(arg)
	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)
	err = engine.RunEngine2(m, eng)
	if e, ok := err.(libkb.AppStatusError); !ok || e.Code != libkb.SCTeamReadError {
		t.Fatalf("expected error type libkb.AppStatusError with code %v, got %T (%+v)", libkb.SCTeamReadError, err, err)
	}
	kbtest.Logout(tc)

	// u2 is part of the team, keyfinding should succeed.
	u2.Login(tc.G)
	uis = libkb.UIs{IdentifyUI: trackUI, SecretUI: u2.NewSecretUI()}
	eng = NewSaltpackRecipientKeyfinderEngineAsInterfaceForTesting(arg)
	m = libkb.NewMetaContextForTest(tc).WithUIs(uis)
	err = engine.RunEngine2(m, eng)
	require.NoError(t, err)

	fDHKeys := eng.GetPublicKIDs()
	if len(fDHKeys) != 1 { // We requested Entity Keys only, so no PUKs or Device Keys (except for the sender's own key)
		t.Errorf("number of DH keys found: %d, expected 1", len(fDHKeys))
	}
	fDHKeyset := make(map[keybase1.KID]struct{})
	for _, fPUK := range fDHKeys {
		fDHKeyset[fPUK] = struct{}{}
	}

	u2PUK := u2.User.GetComputedKeyFamily().GetLatestPerUserKey().EncKID
	if _, ok := fDHKeyset[u2PUK]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", u2PUK)
	}

	symKeys := eng.GetSymmetricKeys()
	if len(symKeys) != 1 {
		t.Errorf("number of symmetric keys found: %d, expected 1", len(symKeys))
	}

	team, err := teams.Load(m.Ctx(), m.G(), keybase1.LoadTeamArg{Name: teamName})
	require.NoError(t, err)
	teamSaltpackKey, err := team.SaltpackEncryptionKeyLatest(m.Ctx())
	require.NoError(t, err)
	require.True(t, bytes.Equal(teamSaltpackKey.Key[:], symKeys[0].Key[:]))

	// Now we look for keys for a team, without including the sender's keys
	arg = libkb.SaltpackRecipientKeyfinderArg{
		TeamRecipients: []string{teamName},
		UseEntityKeys:  true,
		NoSelfEncrypt:  true,
	}
	eng = NewSaltpackRecipientKeyfinderEngineAsInterfaceForTesting(arg)
	err = engine.RunEngine2(m, eng)
	require.NoError(t, err)

	fDHKeys = eng.GetPublicKIDs()
	if len(fDHKeys) != 0 {
		t.Errorf("number of DH keys found: %d, expected 0", len(fDHKeys))
	}

	symKeys = eng.GetSymmetricKeys()
	if len(symKeys) != 1 {
		t.Errorf("number of symmetric keys found: %d, expected 1", len(symKeys))
	}

	require.True(t, bytes.Equal(teamSaltpackKey.Key[:], symKeys[0].Key[:]))

	// Now we look for keys for a team, including the device keys of the members
	arg = libkb.SaltpackRecipientKeyfinderArg{
		TeamRecipients: []string{teamName},
		UseEntityKeys:  true,
		UseDeviceKeys:  true,
	}
	eng = NewSaltpackRecipientKeyfinderEngineAsInterfaceForTesting(arg)
	err = engine.RunEngine2(m, eng)
	require.NoError(t, err)

	fDHKeys = eng.GetPublicKIDs()
	if len(fDHKeys) != 3 { // 1 device key for u1, 1 device key + 1 puk for u2 (as he is the sender).
		t.Errorf("number of DH keys found: %d, expected 3", len(fDHKeys))
	}
	fDHKeyset = make(map[keybase1.KID]struct{})
	for _, fPUK := range fDHKeys {
		fDHKeyset[fPUK] = struct{}{}
	}

	if _, ok := fDHKeyset[u2PUK]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", u2PUK)
	}
	key, err := u1.User.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(u1.User.GetComputedKeyFamily().GetAllActiveDevices()[0].ID)
	require.NoError(t, err)
	KID := key.GetKID()
	if _, ok := fDHKeyset[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}
	key, err = u2.User.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(u2.User.GetComputedKeyFamily().GetAllActiveDevices()[0].ID)
	require.NoError(t, err)
	KID = key.GetKID()
	if _, ok := fDHKeyset[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}

	symKeys = eng.GetSymmetricKeys()
	if len(symKeys) != 1 {
		t.Errorf("number of symmetric keys found: %d, expected 1", len(symKeys))
	}
	require.True(t, bytes.Equal(teamSaltpackKey.Key[:], symKeys[0].Key[:]))

}

func TestSaltpackRecipientKeyfinderTeamWithDeletedUser(t *testing.T) {
	tc := SetupKeyfinderEngineTest(t, "SaltpackRecipientKeyfinderEngine")
	defer tc.Cleanup()

	u1, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)
	u2, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)

	_, teamName := createTeam(tc)
	_, err = teams.AddMember(context.TODO(), tc.G, teamName, u1.Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	// u2 is part of the team, keyfinding should succeed.
	// We look for keys for the team, including the device keys of the members
	trackUI := &kbtest.FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	uis := libkb.UIs{IdentifyUI: trackUI, SecretUI: u2.NewSecretUI()}
	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)
	arg := libkb.SaltpackRecipientKeyfinderArg{
		TeamRecipients: []string{teamName},
		UseEntityKeys:  true,
		UseDeviceKeys:  true,
	}
	eng := NewSaltpackRecipientKeyfinderEngineAsInterfaceForTesting(arg)
	err = engine.RunEngine2(m, eng)
	require.NoError(t, err)

	fDHKeys := eng.GetPublicKIDs()
	if len(fDHKeys) != 3 { // 1 device key for u1, 1 device key + 1 puk for u2 (as he is the sender).
		t.Errorf("number of DH keys found: %d, expected 3", len(fDHKeys))
	}
	fDHKeyset := make(map[keybase1.KID]struct{})
	for _, fPUK := range fDHKeys {
		fDHKeyset[fPUK] = struct{}{}
	}

	u2PUK := u2.User.GetComputedKeyFamily().GetLatestPerUserKey().EncKID
	if _, ok := fDHKeyset[u2PUK]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", u2PUK)
	}

	key, err := u1.User.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(u1.User.GetComputedKeyFamily().GetAllActiveDevices()[0].ID)
	require.NoError(t, err)
	KID := key.GetKID()
	if _, ok := fDHKeyset[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}
	key, err = u2.User.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(u2.User.GetComputedKeyFamily().GetAllActiveDevices()[0].ID)
	require.NoError(t, err)
	KID = key.GetKID()
	if _, ok := fDHKeyset[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}

	symKeys := eng.GetSymmetricKeys()

	team, err := teams.Load(m.Ctx(), m.G(), keybase1.LoadTeamArg{Name: teamName})
	require.NoError(t, err)
	teamSaltpackKey, err := team.SaltpackEncryptionKeyLatest(m.Ctx())
	require.NoError(t, err)

	if len(symKeys) != 1 {
		t.Errorf("number of symmetric keys found: %d, expected 1", len(symKeys))
	}
	require.True(t, bytes.Equal(teamSaltpackKey.Key[:], symKeys[0].Key[:]))

	// Now we delete user u2, and we check that u1 is still able to find keys for the team (which do not include keys for u2).
	kbtest.DeleteAccount(tc, u2)

	u1.Login(tc.G)
	uis = libkb.UIs{IdentifyUI: trackUI, SecretUI: u1.NewSecretUI()}
	m = libkb.NewMetaContextForTest(tc).WithUIs(uis)
	arg = libkb.SaltpackRecipientKeyfinderArg{
		TeamRecipients: []string{teamName},
		UseEntityKeys:  true,
		UseDeviceKeys:  true,
	}
	eng = NewSaltpackRecipientKeyfinderEngineAsInterfaceForTesting(arg)
	err = engine.RunEngine2(m, eng)
	require.NoError(t, err)

	fDHKeys = eng.GetPublicKIDs()
	if len(fDHKeys) != 2 { // 1 device key + 1 puk for u1 (as he is the sender and the only member of the team).
		t.Errorf("number of DH keys found: %d, expected 3", len(fDHKeys))
	}
	fDHKeyset = make(map[keybase1.KID]struct{})
	for _, fPUK := range fDHKeys {
		fDHKeyset[fPUK] = struct{}{}
	}

	u1PUK := u1.User.GetComputedKeyFamily().GetLatestPerUserKey().EncKID
	if _, ok := fDHKeyset[u1PUK]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", u2PUK)
	}

	key, err = u1.User.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(u1.User.GetComputedKeyFamily().GetAllActiveDevices()[0].ID)
	require.NoError(t, err)
	KID = key.GetKID()
	if _, ok := fDHKeyset[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}

	symKeys = eng.GetSymmetricKeys()

	if len(symKeys) != 1 {
		t.Errorf("number of symmetric keys found: %d, expected 1", len(symKeys))
	}
	require.True(t, bytes.Equal(teamSaltpackKey.Key[:], symKeys[0].Key[:]))
}

func TestSaltpackRecipientKeyfinderImplicitTeam(t *testing.T) {
	tc := SetupKeyfinderEngineTest(t, "SaltpackRecipientKeyfinderEngine")
	defer tc.Cleanup()

	teams.ServiceInit(tc.G)

	// First, try to get keys for a non existing user assertion without logging in, which should fail
	b, err := libkb.RandBytes(4)
	require.NoError(tc.T, err)
	nonExistingUserAssertion := "u_" + hex.EncodeToString(b) + "@rooter"

	trackUI := &kbtest.FakeIdentifyUI{
		Proofs: make(map[string]string),
	}

	uis := libkb.UIs{IdentifyUI: trackUI}
	arg := libkb.SaltpackRecipientKeyfinderArg{
		Recipients:    []string{nonExistingUserAssertion},
		UseEntityKeys: true,
		NoSelfEncrypt: true,
	}
	eng := NewSaltpackRecipientKeyfinderEngineAsInterfaceForTesting(arg)
	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)
	err = engine.RunEngine2(m, eng) // Should fail
	if _, ok := err.(libkb.RecipientNotFoundError); !ok {
		t.Fatalf("expected error type libkb.RecipientNotFoundError, got %T (%s)", err, err)
	}

	// Now, retry with a valid user logged in, which should succeed
	u1, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)
	u1.Login(tc.G)

	uis = libkb.UIs{IdentifyUI: trackUI, SecretUI: u1.NewSecretUI()}
	arg = libkb.SaltpackRecipientKeyfinderArg{
		Recipients:    []string{nonExistingUserAssertion},
		UseEntityKeys: true,
	}
	eng = NewSaltpackRecipientKeyfinderEngineAsInterfaceForTesting(arg)
	m = libkb.NewMetaContextForTest(tc).WithUIs(uis)
	err = engine.RunEngine2(m, eng)
	require.NoError(t, err)

	fDHKeys := eng.GetPublicKIDs()
	if len(fDHKeys) != 1 { // This is the sender's own PUK
		t.Errorf("number of DH keys found: %d, expected 1", len(fDHKeys))
	}
	fDHKeyset := make(map[keybase1.KID]struct{})
	for _, fPUK := range fDHKeys {
		fDHKeyset[fPUK] = struct{}{}
	}

	u1PUK := u1.User.GetComputedKeyFamily().GetLatestPerUserKey().EncKID
	if _, ok := fDHKeyset[u1PUK]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", u1PUK)
	}

	symKeys := eng.GetSymmetricKeys()
	if len(symKeys) != 1 {
		t.Errorf("number of symmetric keys found: %d, expected 1", len(symKeys))
	}

	team, _, _, err := teams.LookupImplicitTeam(m.Ctx(), m.G(), u1.Username+","+nonExistingUserAssertion, false, teams.ImplicitTeamOptions{})
	require.NoError(t, err)
	teamSaltpackKey, err := team.SaltpackEncryptionKeyLatest(m.Ctx())
	require.NoError(t, err)
	require.True(t, bytes.Equal(teamSaltpackKey.Key[:], symKeys[0].Key[:]))
}

func TestSaltpackRecipientKeyfinderImplicitTeamNoSelfEncrypt(t *testing.T) {
	tc := SetupKeyfinderEngineTest(t, "SaltpackRecipientKeyfinderEngine")
	defer tc.Cleanup()

	teams.ServiceInit(tc.G)

	// First, try to get keys for a non existing user assertion with NoSelfEncrypt, which should fail
	u1, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)
	u1.Login(tc.G)

	b, err := libkb.RandBytes(4)
	require.NoError(tc.T, err)
	nonExistingUserAssertion := "u_" + hex.EncodeToString(b) + "@rooter"

	trackUI := &kbtest.FakeIdentifyUI{
		Proofs: make(map[string]string),
	}

	uis := libkb.UIs{IdentifyUI: trackUI}
	arg := libkb.SaltpackRecipientKeyfinderArg{
		Recipients:    []string{nonExistingUserAssertion},
		UseEntityKeys: true,
		NoSelfEncrypt: true,
	}
	eng := NewSaltpackRecipientKeyfinderEngineAsInterfaceForTesting(arg)
	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)
	err = engine.RunEngine2(m, eng) // Should fail
	if _, ok := err.(libkb.RecipientNotFoundError); !ok {
		t.Fatalf("expected error type libkb.RecipientNotFoundError, got %T (%s)", err, err)
	}

	// Now, try again without NoSelfEncrypt, which should succeed
	arg = libkb.SaltpackRecipientKeyfinderArg{
		Recipients:    []string{nonExistingUserAssertion},
		UseEntityKeys: true,
	}
	eng = NewSaltpackRecipientKeyfinderEngineAsInterfaceForTesting(arg)
	m = libkb.NewMetaContextForTest(tc).WithUIs(uis)
	err = engine.RunEngine2(m, eng)
	require.NoError(t, err)

	fDHKeys := eng.GetPublicKIDs()
	if len(fDHKeys) != 1 { // This is the sender's own PUK
		t.Errorf("number of DH keys found: %d, expected 1", len(fDHKeys))
	}
	fDHKeyset := make(map[keybase1.KID]struct{})
	for _, fPUK := range fDHKeys {
		fDHKeyset[fPUK] = struct{}{}
	}

	u1PUK := u1.User.GetComputedKeyFamily().GetLatestPerUserKey().EncKID
	if _, ok := fDHKeyset[u1PUK]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", u1PUK)
	}

	symKeys := eng.GetSymmetricKeys()
	if len(symKeys) != 1 {
		t.Errorf("number of symmetric keys found: %d, expected 1", len(symKeys))
	}

	team, _, _, err := teams.LookupImplicitTeam(m.Ctx(), m.G(), u1.Username+","+nonExistingUserAssertion, false, teams.ImplicitTeamOptions{})
	require.NoError(t, err)
	teamSaltpackKey, err := team.SaltpackEncryptionKeyLatest(m.Ctx())
	require.NoError(t, err)
	require.True(t, bytes.Equal(teamSaltpackKey.Key[:], symKeys[0].Key[:]))
}
