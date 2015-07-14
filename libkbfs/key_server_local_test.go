package libkbfs

import (
	"testing"

	"golang.org/x/net/context"
)

// Test that Put/Get works for TLF crypt key server halves.
func TestKeyServerLocalTLFCryptKeyServerHalves(t *testing.T) {
	codec := NewCodecMsgpack()
	ctx := context.Background()
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

	err = keyServer.PutTLFCryptKeyServerHalf(
		ctx, id1, keyGen1, publicKey1, serverHalf1)
	if err != nil {
		t.Fatal(err)
	}

	err = keyServer.PutTLFCryptKeyServerHalf(
		ctx, id2, keyGen1, publicKey1, serverHalf2)
	if err != nil {
		t.Fatal(err)
	}

	err = keyServer.PutTLFCryptKeyServerHalf(
		ctx, id1, keyGen2, publicKey1, serverHalf3)
	if err != nil {
		t.Fatal(err)
	}

	err = keyServer.PutTLFCryptKeyServerHalf(
		ctx, id1, keyGen1, publicKey2, serverHalf4)
	if err != nil {
		t.Fatal(err)
	}

	half1, err := keyServer.GetTLFCryptKeyServerHalf(
		ctx, id1, keyGen1, publicKey1)
	if err != nil {
		t.Error(err)
	}

	if half1 != serverHalf1 {
		t.Errorf("Expected %v, got %v", serverHalf1, half1)
	}

	half2, err := keyServer.GetTLFCryptKeyServerHalf(
		ctx, id2, keyGen1, publicKey1)
	if err != nil {
		t.Error(err)
	}

	if half2 != serverHalf2 {
		t.Errorf("Expected %v, got %v", serverHalf2, half2)
	}

	half3, err := keyServer.GetTLFCryptKeyServerHalf(
		ctx, id1, keyGen2, publicKey1)
	if err != nil {
		t.Error(err)
	}

	if half3 != serverHalf3 {
		t.Errorf("Expected %v, got %v", serverHalf3, half3)
	}

	half4, err := keyServer.GetTLFCryptKeyServerHalf(
		ctx, id1, keyGen1, publicKey2)
	if err != nil {
		t.Error(err)
	}

	if half4 != serverHalf4 {
		t.Errorf("Expected %v, got %v", serverHalf4, half4)
	}

	_, err = keyServer.GetTLFCryptKeyServerHalf(ctx, id2, keyGen2, publicKey2)
	if err == nil {
		t.Error("GetTLFCryptKeyServerHalf(id2, keyGen2, publicKey2) unexpectedly succeeded")
	}
}
