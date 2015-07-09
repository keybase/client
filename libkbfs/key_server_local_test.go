package libkbfs

import "testing"

// Test that Put/Get/Delete works for block crypt key server halves.
func TestKeyServerLocalBlockCryptKeyServerHalves(t *testing.T) {
	codec := NewCodecMsgpack()
	keyServer, err := NewKeyServerMemory(codec)
	if err != nil {
		t.Fatal(err)
	}

	id1 := BlockID{1}
	serverHalf1 := BlockCryptKeyServerHalf{ServerHalf: [32]byte{1}}
	err = keyServer.PutBlockCryptKeyServerHalf(id1, serverHalf1)
	if err != nil {
		t.Fatal(err)
	}

	id2 := BlockID{2}
	serverHalf2 := BlockCryptKeyServerHalf{ServerHalf: [32]byte{2}}
	err = keyServer.PutBlockCryptKeyServerHalf(id2, serverHalf2)
	if err != nil {
		t.Fatal(err)
	}

	half1, err := keyServer.GetBlockCryptKeyServerHalf(id1)
	if err != nil {
		t.Error(err)
	}

	if half1 != serverHalf1 {
		t.Errorf("Expected %v, got %v", serverHalf1, half1)
	}

	half2, err := keyServer.GetBlockCryptKeyServerHalf(id2)
	if err != nil {
		t.Error(err)
	}

	if half2 != serverHalf2 {
		t.Errorf("Expected %v, got %v", serverHalf2, half2)
	}

	id3 := BlockID{3}
	_, err = keyServer.GetBlockCryptKeyServerHalf(id3)
	if err == nil {
		t.Error("GetBlockCryptKeyServerHalf(id3) unexpectedly succeeded")
	}

	for i := 0; i < 2; i++ {
		err = keyServer.DeleteBlockCryptKeyServerHalf(id1)
		if err != nil {
			t.Error(err)
		}

		err = keyServer.DeleteBlockCryptKeyServerHalf(id2)
		if err != nil {
			t.Error(err)
		}

		err = keyServer.DeleteBlockCryptKeyServerHalf(id3)
		if err != nil {
			t.Error(err)
		}
	}
}

// Test that Put/Get works for TLF crypt key server halves.
func TestKeyServerLocalTLFCryptKeyServerHalves(t *testing.T) {
	codec := NewCodecMsgpack()
	keyServer, err := NewKeyServerMemory(codec)
	if err != nil {
		t.Fatal(err)
	}

	id1 := TlfID{1}
	keyGen1 := KeyGen(1)
	publicKey1 := MakeFakeCryptPublicKeyOrBust("public key 1")

	id2 := TlfID{2}
	keyGen2 := KeyGen(2)
	publicKey2 := MakeFakeCryptPublicKeyOrBust("public key 2")

	serverHalf1 := TLFCryptKeyServerHalf{ServerHalf: [32]byte{1}}
	serverHalf2 := TLFCryptKeyServerHalf{ServerHalf: [32]byte{2}}
	serverHalf3 := TLFCryptKeyServerHalf{ServerHalf: [32]byte{3}}
	serverHalf4 := TLFCryptKeyServerHalf{ServerHalf: [32]byte{4}}

	err = keyServer.PutTLFCryptKeyServerHalf(id1, keyGen1, publicKey1, serverHalf1)
	if err != nil {
		t.Fatal(err)
	}

	err = keyServer.PutTLFCryptKeyServerHalf(id2, keyGen1, publicKey1, serverHalf2)
	if err != nil {
		t.Fatal(err)
	}

	err = keyServer.PutTLFCryptKeyServerHalf(id1, keyGen2, publicKey1, serverHalf3)
	if err != nil {
		t.Fatal(err)
	}

	err = keyServer.PutTLFCryptKeyServerHalf(id1, keyGen1, publicKey2, serverHalf4)
	if err != nil {
		t.Fatal(err)
	}

	half1, err := keyServer.GetTLFCryptKeyServerHalf(id1, keyGen1, publicKey1)
	if err != nil {
		t.Error(err)
	}

	if half1 != serverHalf1 {
		t.Errorf("Expected %v, got %v", serverHalf1, half1)
	}

	half2, err := keyServer.GetTLFCryptKeyServerHalf(id2, keyGen1, publicKey1)
	if err != nil {
		t.Error(err)
	}

	if half2 != serverHalf2 {
		t.Errorf("Expected %v, got %v", serverHalf2, half2)
	}

	half3, err := keyServer.GetTLFCryptKeyServerHalf(id1, keyGen2, publicKey1)
	if err != nil {
		t.Error(err)
	}

	if half3 != serverHalf3 {
		t.Errorf("Expected %v, got %v", serverHalf3, half3)
	}

	half4, err := keyServer.GetTLFCryptKeyServerHalf(id1, keyGen1, publicKey2)
	if err != nil {
		t.Error(err)
	}

	if half4 != serverHalf4 {
		t.Errorf("Expected %v, got %v", serverHalf4, half4)
	}

	_, err = keyServer.GetTLFCryptKeyServerHalf(id2, keyGen2, publicKey2)
	if err == nil {
		t.Error("GetTLFCryptKeyServerHalf(id2, keyGen2, publicKey2) unexpectedly succeeded")
	}
}
