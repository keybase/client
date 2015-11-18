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

func TestTokenVerifyToken(t *testing.T) {
	keyPair, err := libkb.GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}
	name := libkb.NewNormalizedUsername("alice")
	uid := libkb.UsernameToUID(name.String())
	expireIn := 10
	tokenType := "test"
	clientName := "test_client"
	clientVersion := "41651"
	token := NewToken(uid, name, keyPair.GetKID(), tokenType, expireIn, clientName, clientVersion)
	sig, _, err := keyPair.SignToString(token.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	_, err = VerifyToken("nope", tokenType, testMaxTokenExpireIn)
	if err == nil {
		t.Fatal(fmt.Errorf("expected verification failure"))
	}
	token, err = VerifyToken(sig, tokenType, testMaxTokenExpireIn)
	if err != nil {
		t.Fatal(err)
	}
	if err = checkToken(token, uid, name, keyPair.GetKID(), tokenType, expireIn, clientName, clientVersion); err != nil {
		t.Fatal(err)
	}
}

func TestTokenExpired(t *testing.T) {
	keyPair, err := libkb.GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}
	name := libkb.NewNormalizedUsername("bob")
	uid := libkb.UsernameToUID(name.String())
	expireIn := 0
	tokenType := "test"
	clientName := "test_client"
	clientVersion := "21021"
	token := NewToken(uid, name, keyPair.GetKID(), tokenType, expireIn, clientName, clientVersion)
	sig, _, err := keyPair.SignToString(token.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	_, err = VerifyToken(sig, tokenType, testMaxTokenExpireIn)
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
	name := libkb.NewNormalizedUsername("charlie")
	uid := libkb.UsernameToUID(name.String())
	expireIn := testMaxTokenExpireIn + 1
	tokenType := "test"
	clientName := "test_client"
	clientVersion := "93021"
	token := NewToken(uid, name, keyPair.GetKID(), tokenType, expireIn, clientName, clientVersion)
	sig, _, err := keyPair.SignToString(token.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	_, err = VerifyToken(sig, tokenType, testMaxTokenExpireIn)
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
	name := libkb.NewNormalizedUsername("dana")
	uid := libkb.UsernameToUID(name.String())
	expireIn := 10
	tokenType := "test"
	clientName := "test_client"
	clientVersion := "20192"
	token := NewToken(uid, name, keyPair.GetKID(), tokenType, expireIn, clientName, clientVersion)
	sig, _, err := keyPair.SignToString(token.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	_, err = VerifyToken(sig, "nope", testMaxTokenExpireIn)
	_, invalid := err.(InvalidTokenTypeError)
	if !invalid {
		t.Fatal(fmt.Errorf("expected invalid token type error"))
	}
	token, err = VerifyToken(sig, tokenType, testMaxTokenExpireIn)
	if err != nil {
		t.Fatal(err)
	}
	if err = checkToken(token, uid, name, keyPair.GetKID(), tokenType, expireIn, clientName, clientVersion); err != nil {
		t.Fatal(err)
	}
}

func checkToken(token *Token, uid keybase1.UID, username libkb.NormalizedUsername,
	kid keybase1.KID, tokenType string, expireIn int, clientName, clientVersion string) error {
	if token.UID() != uid {
		return fmt.Errorf("UID mismatch, expected: %s, got %s", uid, token.UID())
	}
	if token.KID() != kid {
		return fmt.Errorf("KID mismatch, expected: %s, got %s", kid, token.KID())
	}
	if token.Username() != username {
		return fmt.Errorf("Username mismatch, expected: %s, got %s", username, token.Username())
	}
	if token.Type() != tokenType {
		return fmt.Errorf("TokenType mismatch, expected: %s, got %s", tokenType, token.Type())
	}
	if token.ExpireIn != expireIn {
		return fmt.Errorf("ExpireIn mismatch, expected: %d, got %d", expireIn, token.ExpireIn)
	}
	if token.ClientName() != clientName {
		return fmt.Errorf("ClientName mismatch, expected: %s, got %s", clientName, token.ClientName())
	}
	if token.ClientVersion() != clientVersion {
		return fmt.Errorf("ClientVersion mismatch, expected: %s, got %s", clientVersion, token.ClientVersion())
	}
	return nil
}
