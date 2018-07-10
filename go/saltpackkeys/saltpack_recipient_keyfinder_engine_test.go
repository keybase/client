// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.
package saltpackkeys

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	insecureTriplesec "github.com/keybase/go-triplesec-insecure"
)

// TODO add more tests here before merging PR.

// copied from the engine package
func SetupEngineTest(tb libkb.TestingTB, name string) libkb.TestContext {
	tc := externalstest.SetupTest(tb, name, 2)

	// use an insecure triplesec in tests
	tc.G.NewTriplesec = func(passphrase []byte, salt []byte) (libkb.Triplesec, error) {
		warner := func() { tc.G.Log.Warning("Installing insecure Triplesec with weak stretch parameters") }
		isProduction := func() bool {
			return tc.G.Env.GetRunMode() == libkb.ProductionRunMode
		}
		return insecureTriplesec.NewCipher(passphrase, salt, warner, isProduction)
	}

	return tc
}

func TestSaltpackRecipientKeyfinderPUKs(t *testing.T) {
	tc := SetupEngineTest(t, "SaltpackRecipientKeyfinderEngine")
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
	tc := SetupEngineTest(t, "SaltpackRecipientKeyfinderEngine")
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
	tc := SetupEngineTest(t, "SaltpackRecipientKeyfinderEngine")
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
	tc := SetupEngineTest(t, "SaltpackRecipientKeyfinderEngine")
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
	tc := SetupEngineTest(t, "SaltpackRecipientKeyfinderEngine")
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
	tc := SetupEngineTest(t, "SaltpackRecipientKeyfinderEngine")
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
	tc := SetupEngineTest(t, "SaltpackRecipientKeyfinderEngine")
	defer tc.Cleanup()

	u1, err := kbtest.CreateAndSignupFakeUserPaper("spkfe", tc.G)
	require.NoError(t, err)
	u2, err := kbtest.CreateAndSignupFakeUserPaper("spkfe", tc.G)
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
	if len(fPUKs) != 3 {
		t.Errorf("number of device keys found: %d, expected 3", len(fPUKs))
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
	key, err = u2.User.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(u2.User.GetComputedKeyFamily().GetAllActiveDevices()[0].ID)
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

func TestSaltpackRecipientKeyfinderPaperKeys(t *testing.T) {
	tc := SetupEngineTest(t, "SaltpackRecipientKeyfinderEngine")
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

func TestSaltpackRecipientKeyfinderDeviceAndPUKs(t *testing.T) {
	tc := SetupEngineTest(t, "SaltpackRecipientKeyfinderEngine")
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

func TestSaltpackRecipientKeyfinderPaperAndPUKs(t *testing.T) {
	tc := SetupEngineTest(t, "SaltpackRecipientKeyfinderEngine")
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

func TestSaltpackRecipientKeyfinderAllKeys(t *testing.T) {
	tc := SetupEngineTest(t, "SaltpackRecipientKeyfinderEngine")
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
