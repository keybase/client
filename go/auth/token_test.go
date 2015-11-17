// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package auth

import (
	"fmt"
	"testing"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

const testMaxTokenExpireIn = 60

func TestTokenParse(t *testing.T) {
	uid := keybase1.UID("01")
	kid := keybase1.KID("02")
	name := libkb.NormalizedUsername("alice")
	expireIn := 10
	token := NewToken(uid, name, kid, "test", expireIn, "test", "1")
	token, err := ParseToken(token.String())
	if err != nil {
		t.Fatal(err)
	}
	if token.User != uid {
		t.Fatal(fmt.Errorf("UID mismatch, expected: %s, got %s", uid, token.User))
	}
	if token.Key != kid {
		t.Fatal(fmt.Errorf("KID mismatch, expected: %s, got %s", kid, token.Key))
	}
	if token.Username != name {
		t.Fatal(fmt.Errorf("Username mismatch, expected: %s, got %s", name, token.Username))
	}
	if token.TokenType != "test" {
		t.Fatal(fmt.Errorf("TokenType mismatch, expected: test, got %s", token.TokenType))
	}
	if token.ExpireIn != expireIn {
		t.Fatal(fmt.Errorf("ExpireIn mismatch, expected: %d, got %d", expireIn, token.ExpireIn))
	}
	if token.ClientName != "test" {
		t.Fatal(fmt.Errorf("ClientName mismatch, expected: test, got %s", token.ClientName))
	}
	if token.ClientVersion != "1" {
		t.Fatal(fmt.Errorf("ClientVersion mismatch, expected: 1, got %s", token.ClientVersion))
	}
}

func TestTokenVerify(t *testing.T) {
	keyPair, err := libkb.GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}
	uid := keybase1.UID("01")
	name := libkb.NormalizedUsername("alice")
	expireIn := 10
	token := NewToken(uid, name, keyPair.GetKID(), "test", expireIn, "test", "1")
	sig, _, err := keyPair.SignToString(token.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	if err := token.Verify("nope", "test", testMaxTokenExpireIn); err == nil {
		t.Fatal(fmt.Errorf("expected verification failure"))
	}
	if err := token.Verify(sig, "test", testMaxTokenExpireIn); err != nil {
		t.Fatal(err)
	}
}

func TestTokenExpired(t *testing.T) {
	keyPair, err := libkb.GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}
	uid := keybase1.UID("01")
	name := libkb.NormalizedUsername("alice")
	expireIn := 0
	token := NewToken(uid, name, keyPair.GetKID(), "test", expireIn, "test", "1")
	sig, _, err := keyPair.SignToString(token.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	err = token.Verify(sig, "test", testMaxTokenExpireIn)
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
	uid := keybase1.UID("01")
	name := libkb.NormalizedUsername("alice")
	expireIn := testMaxTokenExpireIn + 1
	token := NewToken(uid, name, keyPair.GetKID(), "test", expireIn, "test", "1")
	sig, _, err := keyPair.SignToString(token.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	err = token.Verify(sig, "test", testMaxTokenExpireIn)
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
	uid := keybase1.UID("01")
	name := libkb.NormalizedUsername("alice")
	expireIn := 10
	token := NewToken(uid, name, keyPair.GetKID(), "test", expireIn, "test", "1")
	sig, _, err := keyPair.SignToString(token.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	err = token.Verify(sig, "nope", testMaxTokenExpireIn)
	_, invalid := err.(InvalidTokenTypeError)
	if !invalid {
		t.Fatal(fmt.Errorf("expected invalid token type error"))
	}
}
