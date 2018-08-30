// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package auth

import (
	"crypto/rand"
	"fmt"
	"testing"
	"time"

	"github.com/keybase/client/go/kbcrypto"
	"github.com/keybase/client/go/kbun"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-crypto/ed25519"
	"github.com/stretchr/testify/require"
)

func makeNaclSigningKeyPair(t *testing.T) (kbcrypto.NaclSigningKeyPublic, kbcrypto.NaclSigningKeyPrivate) {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	require.NoError(t, err)

	var publicArray kbcrypto.NaclSigningKeyPublic
	var privateArray kbcrypto.NaclSigningKeyPrivate

	copy(publicArray[:], publicKey)
	copy(privateArray[:], privateKey)

	return publicArray, privateArray
}

const testMaxTokenExpireIn = 60

func TestTokenVerifyToken(t *testing.T) {
	public, private := makeNaclSigningKeyPair(t)
	name := kbun.NewNormalizedUsername("alice")
	uid := kbun.UsernameToUID(name.String())
	expireIn := 10
	server := "test"
	clientName := "test_client"
	clientVersion := "41651"
	challenge, err := GenerateChallenge()
	require.NoError(t, err)
	token := NewToken(uid, name, public.GetKID(), server, challenge,
		time.Now().Unix(), expireIn, clientName, clientVersion)
	sig, _, err := private.SignToStringV0(token.Bytes(), public)
	require.NoError(t, err)
	_, err = VerifyToken("nope", server, challenge, testMaxTokenExpireIn)
	require.NotNil(t, err)
	token, err = VerifyToken(sig, server, challenge, testMaxTokenExpireIn)
	require.NoError(t, err)
	err = checkToken(token, uid, name, public.GetKID(),
		server, challenge, expireIn, clientName, clientVersion)
	require.NoError(t, err)
}

func TestTokenExpired(t *testing.T) {
	public, private := makeNaclSigningKeyPair(t)
	name := kbun.NewNormalizedUsername("bob")
	uid := kbun.UsernameToUID(name.String())
	expireIn := 0
	server := "test"
	clientName := "test_client"
	clientVersion := "21021"
	challenge, err := GenerateChallenge()
	require.NoError(t, err)
	token := NewToken(uid, name, public.GetKID(), server, challenge,
		time.Now().Unix(), expireIn, clientName, clientVersion)
	sig, _, err := private.SignToStringV0(token.Bytes(), public)
	require.NoError(t, err)
	_, err = VerifyToken(sig, server, challenge, testMaxTokenExpireIn)
	require.IsType(t, TokenExpiredError{}, err)
}

func TestMaxExpires(t *testing.T) {
	public, private := makeNaclSigningKeyPair(t)
	name := kbun.NewNormalizedUsername("charlie")
	uid := kbun.UsernameToUID(name.String())
	expireIn := testMaxTokenExpireIn + 10
	server := "test"
	clientName := "test_client"
	clientVersion := "93021"
	challenge, err := GenerateChallenge()
	require.NoError(t, err)
	token := NewToken(uid, name, public.GetKID(), server, challenge,
		time.Now().Unix(), expireIn, clientName, clientVersion)
	sig, _, err := private.SignToStringV0(token.Bytes(), public)
	require.NoError(t, err)
	_, err = VerifyToken(sig, server, challenge, testMaxTokenExpireIn)
	require.IsType(t, MaxTokenExpiresError{}, err)
}

func TestTokenServerInvalid(t *testing.T) {
	public, private := makeNaclSigningKeyPair(t)
	name := kbun.NewNormalizedUsername("dana")
	uid := kbun.UsernameToUID(name.String())
	expireIn := 10
	server := "test"
	clientName := "test_client"
	clientVersion := "20192"
	challenge, err := GenerateChallenge()
	require.NoError(t, err)
	token := NewToken(uid, name, public.GetKID(), server, challenge,
		time.Now().Unix(), expireIn, clientName, clientVersion)
	sig, _, err := private.SignToStringV0(token.Bytes(), public)
	require.NoError(t, err)
	_, err = VerifyToken(sig, "nope", challenge, testMaxTokenExpireIn)
	require.IsType(t, InvalidTokenServerError{}, err)
	token, err = VerifyToken(sig, server, challenge, testMaxTokenExpireIn)
	require.NoError(t, err)
	err = checkToken(token, uid, name, public.GetKID(),
		server, challenge, expireIn, clientName, clientVersion)
	require.NoError(t, err)
}

func TestTokenChallengeInvalid(t *testing.T) {
	public, private := makeNaclSigningKeyPair(t)
	name := kbun.NewNormalizedUsername("dana")
	uid := kbun.UsernameToUID(name.String())
	expireIn := 10
	server := "test"
	clientName := "test_client"
	clientVersion := "20192"
	challenge, err := GenerateChallenge()
	require.NoError(t, err)
	token := NewToken(uid, name, public.GetKID(), server, challenge,
		time.Now().Unix(), expireIn, clientName, clientVersion)
	sig, _, err := private.SignToStringV0(token.Bytes(), public)
	require.NoError(t, err)
	_, err = VerifyToken(sig, server, "nope", testMaxTokenExpireIn)
	require.IsType(t, InvalidTokenChallengeError{}, err)
	token, err = VerifyToken(sig, server, challenge, testMaxTokenExpireIn)
	require.NoError(t, err)
	err = checkToken(token, uid, name, public.GetKID(),
		server, challenge, expireIn, clientName, clientVersion)
	require.NoError(t, err)
}

func checkToken(token *Token, uid keybase1.UID, username kbun.NormalizedUsername,
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
	require.NoError(t, err)
	require.True(t, IsValidChallenge(challenge))
	require.False(t, IsValidChallenge("nope"))
	challenge = challenge[len(challenge)/2:]
	require.False(t, IsValidChallenge(challenge))
}
