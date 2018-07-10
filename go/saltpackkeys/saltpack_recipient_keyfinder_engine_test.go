// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.
package saltpackkeys

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// TODO add tests to retrieve keys for teams (also implicit) before merging PR.

func SetupKeyfinderEngineTest(tb libkb.TestingTB, name string) libkb.TestContext {
	return externalstest.SetupTestWithInsecureTriplesec(tb, name)
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
	}
	eng := NewSaltpackRecipientKeyfinderEngine(arg)
	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)
	if err := engine.RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	fPUKs := eng.GetPublicKIDs()
	if len(fPUKs) != 3 {
		t.Errorf("number of per user keys found: %d, expected 3", len(fPUKs))
	}
	fPUKSet := make(map[keybase1.KID]struct{})
	for _, fPUK := range fPUKs {
		fPUKSet[fPUK] = struct{}{}
	}
	KID := u1.User.GetComputedKeyFamily().GetLatestPerUserKey().EncKID
	if _, ok := fPUKSet[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}
	KID = u2.User.GetComputedKeyFamily().GetLatestPerUserKey().EncKID
	if _, ok := fPUKSet[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}
	KID = u3.User.GetComputedKeyFamily().GetLatestPerUserKey().EncKID
	if _, ok := fPUKSet[KID]; !ok {
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
	}
	eng := NewSaltpackRecipientKeyfinderEngine(arg)
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
		Self:          u3.User,
	}
	eng := NewSaltpackRecipientKeyfinderEngine(arg)
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
		Self:          u3.User, // Since Self is set, this user's keys should be included.
	}
	eng := NewSaltpackRecipientKeyfinderEngine(arg)
	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)
	if err := engine.RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	fPUKs := eng.GetPublicKIDs()
	if len(fPUKs) != 3 {
		t.Errorf("number of per user keys found: %d, expected 3", len(fPUKs))
	}
	fPUKSet := make(map[keybase1.KID]struct{})
	for _, fPUK := range fPUKs {
		fPUKSet[fPUK] = struct{}{}
	}
	KID := u1.User.GetComputedKeyFamily().GetLatestPerUserKey().EncKID
	if _, ok := fPUKSet[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}
	KID = u2.User.GetComputedKeyFamily().GetLatestPerUserKey().EncKID
	if _, ok := fPUKSet[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}
	KID = u3.User.GetComputedKeyFamily().GetLatestPerUserKey().EncKID
	if _, ok := fPUKSet[KID]; !ok {
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
		Self:          u3.User,
	}
	eng := NewSaltpackRecipientKeyfinderEngine(arg)
	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)
	if err := engine.RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	fPUKs := eng.GetPublicKIDs()
	if len(fPUKs) != 2 {
		t.Errorf("number of per user keys found: %d, expected 2", len(fPUKs))
	}
	fPUKSet := make(map[keybase1.KID]struct{})
	for _, fPUK := range fPUKs {
		fPUKSet[fPUK] = struct{}{}
	}
	KID := u1.User.GetComputedKeyFamily().GetLatestPerUserKey().EncKID
	if _, ok := fPUKSet[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}
	KID = u2.User.GetComputedKeyFamily().GetLatestPerUserKey().EncKID
	if _, ok := fPUKSet[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}

	symKeys := eng.GetSymmetricKeys()
	if len(symKeys) != 0 {
		t.Errorf("number of symmetric keys found: %d, expected 0", len(symKeys))
	}

}

func TestSaltpackRecipientKeyfinderFailsIfUserHasNoPUK(t *testing.T) {
	tc := SetupKeyfinderEngineTest(t, "SaltpackRecipientKeyfinderEngine")
	defer tc.Cleanup()

	u1, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)
	u2, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)

	// u3 will have NO PUK
	tc.Tp.DisableUpgradePerUserKey = true
	u3, err := kbtest.CreateAndSignupFakeUser("spkfe", tc.G)
	require.NoError(t, err)

	trackUI := &kbtest.FakeIdentifyUI{
		Proofs: make(map[string]string),
	}

	uis := libkb.UIs{IdentifyUI: trackUI, SecretUI: u2.NewSecretUI()}
	arg := libkb.SaltpackRecipientKeyfinderArg{
		Recipients:    []string{u1.Username},
		UseEntityKeys: true,
		Self:          u2.User,
	}
	eng := NewSaltpackRecipientKeyfinderEngine(arg)
	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)

	// This should work with no errors, as u3 is not involved.
	if err := engine.RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}
	fPUKs := eng.GetPublicKIDs()
	if len(fPUKs) != 2 {
		t.Errorf("number of per user keys found: %d, expected 2", len(fPUKs))
	}
	fPUKSet := make(map[keybase1.KID]struct{})
	for _, fPUK := range fPUKs {
		fPUKSet[fPUK] = struct{}{}
	}
	KID := u1.User.GetComputedKeyFamily().GetLatestPerUserKey().EncKID
	if _, ok := fPUKSet[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}
	KID = u2.User.GetComputedKeyFamily().GetLatestPerUserKey().EncKID
	if _, ok := fPUKSet[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}

	// This should fail, as u3 has no PUK
	arg = libkb.SaltpackRecipientKeyfinderArg{
		Recipients:    []string{u1.Username, u3.Username},
		UseEntityKeys: true,
		Self:          u2.User,
	}
	eng = NewSaltpackRecipientKeyfinderEngine(arg)
	err = engine.RunEngine2(m, eng)
	if _, expectedErrorType := err.(libkb.NoNaClEncryptionKeyError); !expectedErrorType {
		t.Fatalf("expected a NoNaClEncryptionKeyError, got %+v", err)
	}
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
	kbtest.ProvisionNewDeviceKex(&tc, &tcY, u2)
	tc.G.BustLocalUserCache(u2.GetUID())
	tc.G.GetUPAKLoader().ClearMemory()
	u2new, err := libkb.LoadMe(libkb.NewLoadUserArgWithMetaContext(libkb.NewMetaContextForTest(tc)))
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
	eng := NewSaltpackRecipientKeyfinderEngine(arg)
	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)
	if err := engine.RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	fPUKs := eng.GetPublicKIDs()
	if len(fPUKs) != 4 {
		t.Errorf("number of device keys found: %d, expected 4", len(fPUKs))
	}
	fPUKSet := make(map[keybase1.KID]struct{})
	for _, fPUK := range fPUKs {
		fPUKSet[fPUK] = struct{}{}
	}

	key, err := u1.User.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(u1.User.GetComputedKeyFamily().GetAllActiveDevices()[0].ID)
	require.NoError(t, err)
	KID := key.GetKID()
	if _, ok := fPUKSet[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}
	key, err = u2new.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(u2new.GetComputedKeyFamily().GetAllActiveDevices()[0].ID)
	require.NoError(t, err)
	KID = key.GetKID()
	if _, ok := fPUKSet[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}
	key, err = u2new.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(u2new.GetComputedKeyFamily().GetAllActiveDevices()[1].ID)
	require.NoError(t, err)
	KID = key.GetKID()
	if _, ok := fPUKSet[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}
	key, err = u3.User.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(u3.User.GetComputedKeyFamily().GetAllActiveDevices()[0].ID)
	require.NoError(t, err)
	KID = key.GetKID()
	if _, ok := fPUKSet[KID]; !ok {
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
	eng := NewSaltpackRecipientKeyfinderEngine(arg)
	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)
	if err := engine.RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	fPUKs := eng.GetPublicKIDs()
	if len(fPUKs) != 3 {
		t.Errorf("number of device keys found: %d, expected 3", len(fPUKs))
	}
	fPUKSet := make(map[keybase1.KID]struct{})
	for _, fPUK := range fPUKs {
		fPUKSet[fPUK] = struct{}{}
	}

	id, err := selectOneActivePaperDeviceID(u1.User)
	require.NoError(t, err)
	key, err := u1.User.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(id)
	require.NoError(t, err)
	KID := key.GetKID()
	if _, ok := fPUKSet[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}
	id, err = selectOneActivePaperDeviceID(u1.User)
	require.NoError(t, err)
	key, err = u1.User.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(id)
	require.NoError(t, err)
	KID = key.GetKID()
	if _, ok := fPUKSet[KID]; !ok {
		t.Errorf("expected to find key %v, which was not retrieved", KID)
	}
	id, err = selectOneActivePaperDeviceID(u1.User)
	require.NoError(t, err)
	key, err = u1.User.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(id)
	require.NoError(t, err)
	KID = key.GetKID()
	if _, ok := fPUKSet[KID]; !ok {
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
	kbtest.ProvisionNewDeviceKex(&tc, &tcY, u2)
	tc.G.BustLocalUserCache(u2.GetUID())
	tc.G.GetUPAKLoader().ClearMemory()
	u2new, err := libkb.LoadMe(libkb.NewLoadUserArgWithMetaContext(libkb.NewMetaContextForTest(tc)))
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
	eng := NewSaltpackRecipientKeyfinderEngine(arg)
	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)
	if err := engine.RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	fPUKs := eng.GetPublicKIDs()
	if len(fPUKs) != 10 { // 3 keys per user (1 paper, 1 device, 1 puk), plus an extra device for u2
		t.Errorf("number of device keys found: %d, expected 4", len(fPUKs))
	}
	fPUKSet := make(map[keybase1.KID]struct{})
	for _, fPUK := range fPUKs {
		fPUKSet[fPUK] = struct{}{}
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
		if _, ok := fPUKSet[KID]; !ok {
			t.Errorf("expected to find key %v, which was not retrieved", KID)
		}
	}
	symKeys := eng.GetSymmetricKeys()
	if len(symKeys) != 0 {
		t.Errorf("number of symmetric keys found: %d, expected 0", len(symKeys))
	}
}
