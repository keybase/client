// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// Tests for the DeviceKeyfinder engine.

package saltpackKeyHelpers

// TODO add tests here before merging PR.

// func TestSaltpackUserKeyfinder(t *testing.T) {
// 	tc := SetupEngineTest(t, "SaltpackUserKeyfinder")
// 	defer tc.Cleanup()

// 	u1 := CreateAndSignupFakeUser(tc, "naclp")
// 	u2 := CreateAndSignupFakeUser(tc, "naclp")
// 	u3 := CreateAndSignupFakeUser(tc, "naclp")

// 	trackUI := &FakeIdentifyUI{
// 		Proofs: make(map[string]string),
// 	}

// 	uis := libkb.UIs{IdentifyUI: trackUI, SecretUI: u3.NewSecretUI()}
// 	arg := libkb.SaltpackRecipientKeyfinderArg{
// 		Recipients:    []string{u1.Username, u2.Username, u3.Username},
// 		UseEntityKeys: true,
// 	}
// 	eng := NewSaltpackUserKeyfinder(tc.G, arg)
// 	m := NewMetaContextForTest(tc).WithUIs(uis)
// 	if err := RunEngine2(m, eng); err != nil {
// 		t.Fatal(err)
// 	}

// 	up := eng.GetPublicKIDs()
// 	if len(up) != 3 {
// 		t.Errorf("number of users found: %d, expected 3", len(up))
// 	}
// }
