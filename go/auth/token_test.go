// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package auth

import (
	"fmt"
	"testing"

	libkb "github.com/keybase/client/go/libkb"
)

const testMaxTokenExpireIn = 60

func TestTokenVerifyToken(t *testing.T) {
	keyPair, err := libkb.GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}
	name := libkb.NormalizedUsername("alice")
	uid := libkb.UsernameToUID(name.String())
	expireIn := 10
	token := NewToken(uid, name, keyPair.GetKID(), "test", expireIn, "test", "1")
	sig, _, err := keyPair.SignToString(token.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	_, err = VerifyToken("nope", "test", testMaxTokenExpireIn)
	if err == nil {
		t.Fatal(fmt.Errorf("expected verification failure"))
	}
	token, err = VerifyToken(sig, "test", testMaxTokenExpireIn)
	if err != nil {
		t.Fatal(err)
	}
	if token.UID() != uid {
		t.Fatal(fmt.Errorf("UID mismatch, expected: %s, got %s", uid, token.UID()))
	}
	if token.KID() != keyPair.GetKID() {
		t.Fatal(fmt.Errorf("KID mismatch, expected: %s, got %s", keyPair.GetKID(), token.KID()))
	}
	if token.Username() != name {
		t.Fatal(fmt.Errorf("Username mismatch, expected: %s, got %s", name, token.Username()))
	}
	if token.Type() != "test" {
		t.Fatal(fmt.Errorf("TokenType mismatch, expected: test, got %s", token.Type()))
	}
	if token.ExpireIn != expireIn {
		t.Fatal(fmt.Errorf("ExpireIn mismatch, expected: %d, got %d", expireIn, token.ExpireIn))
	}
	if token.ClientName() != "test" {
		t.Fatal(fmt.Errorf("ClientName mismatch, expected: test, got %s", token.ClientName()))
	}
	if token.ClientVersion() != "1" {
		t.Fatal(fmt.Errorf("ClientVersion mismatch, expected: 1, got %s", token.ClientVersion()))
	}
}

func TestTokenExpired(t *testing.T) {
	keyPair, err := libkb.GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}
	name := libkb.NormalizedUsername("alice")
	uid := libkb.UsernameToUID(name.String())
	expireIn := 0
	token := NewToken(uid, name, keyPair.GetKID(), "test", expireIn, "test", "1")
	sig, _, err := keyPair.SignToString(token.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	_, err = VerifyToken(sig, "test", testMaxTokenExpireIn)
	_, expired := err.(TokenExpiredError)
	if !expired {
		t.Fatal(fmt.Errorf("expected token expired error"))
	}
}

func TestMaxExpires(t *testing.T) {
	keyPair, err := libkb.GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}
	name := libkb.NormalizedUsername("alice")
	uid := libkb.UsernameToUID(name.String())
	expireIn := testMaxTokenExpireIn + 1
	token := NewToken(uid, name, keyPair.GetKID(), "test", expireIn, "test", "1")
	sig, _, err := keyPair.SignToString(token.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	_, err = VerifyToken(sig, "test", testMaxTokenExpireIn)
	_, maxExpires := err.(MaxTokenExpiresError)
	if !maxExpires {
		t.Fatal(fmt.Errorf("expected max token expires error"))
	}
}

func TestTokenTypeInvalid(t *testing.T) {
	keyPair, err := libkb.GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}
	name := libkb.NormalizedUsername("alice")
	uid := libkb.UsernameToUID(name.String())
	expireIn := 10
	token := NewToken(uid, name, keyPair.GetKID(), "test", expireIn, "test", "1")
	sig, _, err := keyPair.SignToString(token.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	_, err = VerifyToken(sig, "nope", testMaxTokenExpireIn)
	_, invalid := err.(InvalidTokenTypeError)
	if !invalid {
		t.Fatal(fmt.Errorf("expected invalid token type error"))
	}
}
