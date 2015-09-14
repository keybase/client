package engine

import "testing"

func TestScanKeys(t *testing.T) {
	tc := SetupEngineTest(t, "ScanKeys")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "login")

	sk, err := NewScanKeys(fu.NewSecretUI(), &FakeIdentifyUI{}, nil, "test scan keys", tc.G)
	if err != nil {
		t.Fatal(err)
	}

	if sk.Count() != 0 {
		t.Errorf("scankey count: %d, expected 0", sk.Count())
	}
}

// TestScanKeysSync checks a user with a synced
func TestScanKeysSync(t *testing.T) {
	tc := SetupEngineTest(t, "PGPDecrypt")
	defer tc.Cleanup()
	fu := createFakeUserWithPGPOnly(t, tc)

	sk, err := NewScanKeys(fu.NewSecretUI(), &FakeIdentifyUI{}, nil, "test scan keys", tc.G)
	if err != nil {
		t.Fatal(err)
	}

	if sk.Count() != 1 {
		t.Errorf("scankey count: %d, expected 1", sk.Count())
	}
}
