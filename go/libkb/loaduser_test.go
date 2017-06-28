// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"testing"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func TestLoadUserPlusKeys(t *testing.T) {
	tc := SetupTest(t, "user plus keys", 1)
	defer tc.Cleanup()

	// this is kind of pointless as there is no cache anymore
	for i := 0; i < 10; i++ {
		u, err := LoadUserPlusKeys(nil, tc.G, "295a7eea607af32040647123732bc819", "")
		if err != nil {
			t.Fatal(err)
		}
		if u.Username != "t_alice" {
			t.Errorf("username: %s, expected t_alice", u.Username)
		}
		if len(u.RevokedDeviceKeys) > 0 {
			t.Errorf("t_alice found with %d revoked keys, expected 0", len(u.RevokedDeviceKeys))
		}
	}

	for _, uid := range []keybase1.UID{"295a7eea607af32040647123732bc819", "afb5eda3154bc13c1df0189ce93ba119", "9d56bd0c02ac2711e142faf484ea9519", "c4c565570e7e87cafd077509abf5f619", "561247eb1cc3b0f5dc9d9bf299da5e19"} {
		_, err := LoadUserPlusKeys(nil, tc.G, uid, "")
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestLoadUserPlusKeysNoKeys(t *testing.T) {
	tc := SetupTest(t, "user plus keys", 1)
	defer tc.Cleanup()

	// t_ellen has no keys.  There should be no error loading her.
	u, err := LoadUserPlusKeys(nil, tc.G, "561247eb1cc3b0f5dc9d9bf299da5e19", "")
	if err != nil {
		t.Fatal(err)
	}
	if u.Username != "t_ellen" {
		t.Errorf("username: %s, expected t_ellen", u.Username)
	}
}

func TestRevokedKeys(t *testing.T) {
	tc := SetupTest(t, "revoked keys", 1)
	defer tc.Cleanup()

	u, err := LoadUserPlusKeys(nil, tc.G, "ff261e3b26543a24ba6c0693820ead19", "")
	if err != nil {
		t.Fatal(err)
	}
	if u.Username != "t_mike" {
		t.Errorf("username: %s, expected t_mike", u.Username)
	}
	if len(u.RevokedDeviceKeys) != 2 {
		t.Errorf("t_mike found with %d revoked keys, expected 2", len(u.RevokedDeviceKeys))
	}

	kid := keybase1.KID("012073f26b5996912393f7d2961ca90968e4e83d6140e9771ba890ff8ba6ea97777e0a")
	for index, k := range u.RevokedDeviceKeys {
		if k.By != kid {
			t.Errorf("wrong revoking KID (index: %d) %s != %s", index, k.By, kid)
		}
	}
}

func BenchmarkLoadSigChains(b *testing.B) {
	tc := SetupTest(b, "benchmark load user", 1)
	u, err := LoadUser(NewLoadUserByNameArg(tc.G, "t_george"))
	if err != nil {
		b.Fatal(err)
	}
	if u == nil {
		b.Fatal("no user")
	}
	u.sigChainMem = nil
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if err = u.LoadSigChains(nil, &u.leaf, false); err != nil {
			b.Fatal(err)
		}
		u.sigChainMem = nil
	}
}

func BenchmarkLoadUserPlusKeys(b *testing.B) {
	tc := SetupTest(b, "bench_user_plus_keys", 1)
	u, err := LoadUser(NewLoadUserByNameArg(tc.G, "t_george"))
	if err != nil {
		b.Fatal(err)
	}
	if u == nil {
		b.Fatal("no user")
	}
	uid := u.GetUID()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := LoadUserPlusKeys(nil, tc.G, uid, "")
		if err != nil {
			b.Fatal(err)
		}
	}
}
