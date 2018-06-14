package libkb

import (
	"encoding/json"
	"testing"
)

func TestMerkleRootPayloadUnmarshalWithSkips(t *testing.T) {
	raw := `{"body":{"kbfs":{"private":{"root":null,"version":null},"public":{"root":null,"version":null}},"key":{"fingerprint":"a05161510ee696601ba0ec7b3fd53b4871528cef","key_id":"3FD53B4871528CEF"},"legacy_uid_root":"75ac465f4cef9a32e593692c4c2db371401ed2cd7781b74a8210b49da116c514","prev":"a172068e89cfb73316e35ebee41adc3f42e882d042272553397e54208b7537e616cc16284ca714f442f459948af4660d43abc82a74b39a0b17c939739477856d","root":"04ae5a2268d8220a8a8a2392585bedeee6be1e81ad06d3b3355d0128725b52cf0f219e28f16781514e399b10dc0fb3a642a1b5ed66ba99b5e1f73df1be6e2d0b","seqno":228223,"skips":{"162687":"","195455":"","211839":"","220031":"","224127":"","226175":"","227199":"","227711":"fb99c7ba0844733318de3aaea7e19144c4ebc20365b5b90e8c443103c6975bd7","227967":"00b799c5df435ad5d746d52431f45f9522f137194d0ff8def84370b1ae5b5848","228095":"4ffd2cfdb108bdffaf61dd9e9c74a2ade6509509b96b852c2372f7fd25ed9188","228159":"cc57e780c9314377766855f324435e09e88c3d6f48c0ccdefb4da24915f50503","228191":"7032b5a573c3bece570fe5f3cfaa01a42ba673163898a4534c8a89dc0fb0954b","228207":"30ca14d7cdbfc444a141e82e2f02223d7e3226ab4626cfa00bc57fb5adf62ff7","228215":"e598fb8705203a24b6b1c722ddf61c9ca7055fe0d9c9f887186fec7148a2852d","228219":"bf7b127bf77224285492241654c3d1aea63a441fed64ac5d2a2e96ce89e3fa95","228221":"339edfa9f4fc2c6a5236bf390ef9906043684c579ccc36ef7b8ef88e330090cc","228222":"923f78febf3cc1134c382eb909d7bfc89968b40c94ca3f6a8402a0beef4199a1","97151":""},"txid":"e984c08f00430dab7200db56a84e8515","type":"merkle_root","version":1},"ctime":1484154393,"tag":"signature"}`
	var r MerkleRootPayloadUnpacked
	err := json.Unmarshal([]byte(raw), &r)
	if err != nil {
		t.Fatal(err)
	}
	var h NodeHash
	h, err = NodeHashFromHex(`fb99c7ba0844733318de3aaea7e19144c4ebc20365b5b90e8c443103c6975bd7`)
	if err != nil {
		t.Fatal(err)
	}
	if !hashEq(h, r.Body.Skips[227711]) {
		t.Fatal("should have had hash equality")
	}
}

func TestMerkleRootPayloadUnmarshalWithoutSkips(t *testing.T) {
	raw := `{"body":{"kbfs":{"private":{"root":"iKNlcGvEICJOVuOROjr8mEPkhETSMBpVZBJ41nBYBuodK/OrXGFaoWjEQINGJ9t9R8Eu4kLPLihrqqB21NDlieEMizSPcogzKeR3Q4Hsmt/uid87xpmvrZc4LhAQOX62sCEf3KTaSWjZG0Gjbm9uxBgfGYN0/evl0mbBib/jafJ/5yJIcDizzhiicHLEQMW85WnignmXsa5mLomnmduzUSksYOxUZU1bvJwn9Isj5Tyw2AL4t4t3nzgF1VEricihIF5N7+Pih/HlO0HAFE6ic27NHi2hdAKidHPOWHespKF2AQ==","version":1},"public":{"root":"hqFoxEBK5PjCumUTQuUrwDPI08l8x+QgiEqq5AbRVQGimEjDozDf6ax5mKh/A3qGv5Sjgxqkni36/rKxE6JBODpXJwJjonByxEBpdeld3+IbKVY7ACqtETV9cXP1UPO+Sxj+zJ2PdmmuelBZIYcW3FgcGiPJm15d/rpnSq2ob4m7u8B1wgWeLpcbonNuzR42oXQBonRzzlh3rJehdgE=","version":1}},"key":{"fingerprint":"03e146cdaf8136680ad566912a32340cec8c9492","key_id":"2A32340CEC8C9492"},"legacy_uid_root":"0c58a74abcb1db656146ebf667b5ea5cc55e208fbb534cd1b1e9454890358e5e","prev":"f82f0d1c236703205690110203e34cd9fc5dfb7a6bef386e81a1c9301b101deea176fae530ca654424cdd72565f1dc196af1eaed203b7dd0a100d672080b1961","root":"976a48126ced7ba136ef1a33e337c9ad22ca233eb19d46a5a1de482653b0ac25e35d3e55f1cb1fc5a29e62df5612581909afe8a26dc44710da5094445f009af0","seqno":796746,"txid":"db7ad0824c5753c28bc849d60e711815","type":"merkle_root","version":1},"ctime":1484239402,"tag":"signature"}`
	var r MerkleRootPayloadUnpacked
	err := json.Unmarshal([]byte(raw), &r)
	if err != nil {
		t.Fatal(err)
	}
	if r.Body.Skips != nil {
		t.Fatal("expected an empty skip table")
	}
}

func TestMerkleSkipVectors(t *testing.T) {
	tc := SetupTest(t, "TestMerkleSkipVectors", 1)
	defer tc.Cleanup()
	for i, v := range merkleSkipTestVectors {
		ss, err := readSkipSequenceFromStringList(v.data)
		if err != nil {
			t.Fatal(err)
		}
		err = ss.verify(NewMetaContextForTest(tc), skipTestVectorsThisRoot, skipTestVectorsLastRoot)

		tc.G.Log.Info("Iteration %d: test %s: %v", i, v.name, err)

		if v.e == merkleErrorNone && err != nil {
			t.Fatalf("Expected no error in test %s, but got %s", v.name, err)
		}

		if v.e == merkleErrorNone {
			continue
		}
		me, ok := err.(MerkleClientError)
		if !ok {
			t.Fatalf("Got an unexpected error type in test %s: %T (%v)", v.name, err, err)
		}
		if me.t != v.e {
			t.Fatalf("Got wrong error type in test %s: %v != %v", v.name, me.t, v.e)
		}
	}
}
