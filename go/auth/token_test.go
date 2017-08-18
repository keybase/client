// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package auth

import (
	"fmt"
	"testing"
	"time"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
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
	server := "test"
	clientName := "test_client"
	clientVersion := "41651"
	challenge, err := GenerateChallenge()
	if err != nil {
		t.Fatal(err)
	}
	token := NewToken(uid, name, keyPair.GetKID(), server, challenge,
		time.Now().Unix(), expireIn, clientName, clientVersion)
	sig, _, err := keyPair.SignToString(token.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	_, err = VerifyToken("nope", server, challenge, testMaxTokenExpireIn)
	if err == nil {
		t.Fatal(fmt.Errorf("expected verification failure"))
	}
	token, err = VerifyToken(sig, server, challenge, testMaxTokenExpireIn)
	if err != nil {
		t.Fatal(err)
	}
	if err = checkToken(token, uid, name, keyPair.GetKID(),
		server, challenge, expireIn, clientName, clientVersion); err != nil {
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
	server := "test"
	clientName := "test_client"
	clientVersion := "21021"
	challenge, err := GenerateChallenge()
	if err != nil {
		t.Fatal(err)
	}
	token := NewToken(uid, name, keyPair.GetKID(), server, challenge,
		time.Now().Unix(), expireIn, clientName, clientVersion)
	sig, _, err := keyPair.SignToString(token.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	_, err = VerifyToken(sig, server, challenge, testMaxTokenExpireIn)
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
	expireIn := testMaxTokenExpireIn + 10
	server := "test"
	clientName := "test_client"
	clientVersion := "93021"
	challenge, err := GenerateChallenge()
	if err != nil {
		t.Fatal(err)
	}
	token := NewToken(uid, name, keyPair.GetKID(), server, challenge,
		time.Now().Unix(), expireIn, clientName, clientVersion)
	sig, _, err := keyPair.SignToString(token.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	_, err = VerifyToken(sig, server, challenge, testMaxTokenExpireIn)
	_, maxExpires := err.(MaxTokenExpiresError)
	if !maxExpires {
		t.Fatal(fmt.Errorf("expected max token expires error"))
	}
}

func TestTokenServerInvalid(t *testing.T) {
	keyPair, err := libkb.GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}
	name := libkb.NewNormalizedUsername("dana")
	uid := libkb.UsernameToUID(name.String())
	expireIn := 10
	server := "test"
	clientName := "test_client"
	clientVersion := "20192"
	challenge, err := GenerateChallenge()
	if err != nil {
		t.Fatal(err)
	}
	token := NewToken(uid, name, keyPair.GetKID(), server, challenge,
		time.Now().Unix(), expireIn, clientName, clientVersion)
	sig, _, err := keyPair.SignToString(token.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	_, err = VerifyToken(sig, "nope", challenge, testMaxTokenExpireIn)
	_, invalid := err.(InvalidTokenServerError)
	if !invalid {
		t.Fatal(fmt.Errorf("expected invalid token server error"))
	}
	token, err = VerifyToken(sig, server, challenge, testMaxTokenExpireIn)
	if err != nil {
		t.Fatal(err)
	}
	if err = checkToken(token, uid, name, keyPair.GetKID(),
		server, challenge, expireIn, clientName, clientVersion); err != nil {
		t.Fatal(err)
	}
}

func TestTokenChallengeInvalid(t *testing.T) {
	keyPair, err := libkb.GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}
	name := libkb.NewNormalizedUsername("dana")
	uid := libkb.UsernameToUID(name.String())
	expireIn := 10
	server := "test"
	clientName := "test_client"
	clientVersion := "20192"
	challenge, err := GenerateChallenge()
	if err != nil {
		t.Fatal(err)
	}
	token := NewToken(uid, name, keyPair.GetKID(), server, challenge,
		time.Now().Unix(), expireIn, clientName, clientVersion)
	sig, _, err := keyPair.SignToString(token.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	_, err = VerifyToken(sig, server, "nope", testMaxTokenExpireIn)
	_, invalid := err.(InvalidTokenChallengeError)
	if !invalid {
		t.Fatal(fmt.Errorf("expected invalid token server error"))
	}
	token, err = VerifyToken(sig, server, challenge, testMaxTokenExpireIn)
	if err != nil {
		t.Fatal(err)
	}
	if err = checkToken(token, uid, name, keyPair.GetKID(),
		server, challenge, expireIn, clientName, clientVersion); err != nil {
		t.Fatal(err)
	}
}

func checkToken(token *Token, uid keybase1.UID, username libkb.NormalizedUsername,
	kid keybase1.KID, server, challenge string, expireIn int, clientName, clientVersion string) error {
	if token.UID() != uid {
		return fmt.Errorf("UID mismatch, expected: %s, got %s",
			uid, token.UID())
	}
	if token.KID() != kid {
		return fmt.Errorf("KID mismatch, expected: %s, got %s",
			kid, token.KID())
	}
	if token.Username() != username {
		return fmt.Errorf("Username mismatch, expected: %s, got %s",
			username, token.Username())
	}
	if token.Type() != TokenType {
		return fmt.Errorf("TokenType mismatch, expected: %s, got %s",
			TokenType, token.Type())
	}
	if token.Server() != server {
		return fmt.Errorf("Server mismatch, expected: %s, got %s",
			server, token.Server())
	}
	if token.Challenge() != challenge {
		return fmt.Errorf("Challenge mismatch, expected: %s, got %s",
			challenge, token.Challenge())
	}
	if token.ExpireIn != expireIn {
		return fmt.Errorf("ExpireIn mismatch, expected: %d, got %d",
			expireIn, token.ExpireIn)
	}
	if token.ClientName() != clientName {
		return fmt.Errorf("ClientName mismatch, expected: %s, got %s",
			clientName, token.ClientName())
	}
	if token.ClientVersion() != clientVersion {
		return fmt.Errorf("ClientVersion mismatch, expected: %s, got %s",
			clientVersion, token.ClientVersion())
	}
	return nil
}

func TestIsValidChallenge(t *testing.T) {
	challenge, err := GenerateChallenge()
	if err != nil {
		t.Fatal(err)
	}
	if !IsValidChallenge(challenge) {
		t.Fatal(fmt.Errorf("Invalid challenge: %s", challenge))
	}
	if IsValidChallenge("nope") {
		t.Fatal("Expected invalid challenge")
	}
	challenge = challenge[len(challenge)/2:]
	if IsValidChallenge(challenge) {
		t.Fatal("Expected invalid challenge")
	}
}
