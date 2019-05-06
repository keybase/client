// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build linux,!skipkeyringtests

package libkb

import (
	"fmt"
	"os"
	"testing"

	secsrv "github.com/keybase/go-keychain/secretservice"
	"github.com/stretchr/testify/require"
)

func secret() LKSecFullSecret {
	sec, err := newLKSecFullSecretFromBytes([]byte("YELLOW_SUBMARINEYELLOW_SUBMARINE"))
	if err != nil {
		panic(err)
	}
	return sec
}

func requireError(t *testing.T, err error, msg string) {
	require.Error(t, err)
	require.Contains(t, err.Error(), msg)
}

var alice = NewNormalizedUsername("alice")
var bob = NewNormalizedUsername("bob")
var charlie = NewNormalizedUsername("charlie")

func TestSSSSBasic(t *testing.T) {
	t.Skip("Skipping secret service test while Linux CI AMI is being upgraded to include keyring")

	tc := SetupTest(t, "secret_store_secretservice", 0)
	defer tc.Cleanup()
	mctx := NewMetaContextForTest(tc)

	sec := secret()

	s := NewSecretStoreRevokableSecretService()
	err := s.StoreSecret(mctx, alice, sec)
	require.NoError(t, err)

	gotSec, err := s.RetrieveSecret(mctx, alice)
	require.NoError(t, err)
	require.Equal(t, sec, gotSec)

	err = s.ClearSecret(mctx, alice)
	require.NoError(t, err)

	_, err = s.RetrieveSecret(mctx, alice)
	requireError(t, err.(UnboxError), "no such file")

	err = s.StoreSecret(mctx, alice, sec)
	require.NoError(t, err)
	err = s.StoreSecret(mctx, bob, sec)
	require.NoError(t, err)
	err = s.StoreSecret(mctx, charlie, sec)
	require.NoError(t, err)
	gotSec, err = s.RetrieveSecret(mctx, charlie)
	require.NoError(t, err)
	require.Equal(t, sec, gotSec)

	users, err := s.GetUsersWithStoredSecrets(mctx)
	require.NoError(t, err)
	require.Equal(t, []string{"alice", "bob", "charlie"}, users)

	err = s.ClearSecret(mctx, alice)
	require.NoError(t, err)
	err = s.ClearSecret(mctx, bob)
	require.NoError(t, err)
	err = s.ClearSecret(mctx, charlie)
	require.NoError(t, err)
}

func TestSSSSCorruptKeystore(t *testing.T) {
	t.Skip("Skipping secret service test while Linux CI AMI is being upgraded to include keyring")

	tc := SetupTest(t, "secret_store_secretservice", 0)
	defer tc.Cleanup()
	mctx := NewMetaContextForTest(tc)

	s := NewSecretStoreRevokableSecretService()
	err := s.StoreSecret(mctx, alice, secret())
	require.NoError(t, err)

	keystore := s.keystore(mctx, "alice", nil)
	keypath := keystore.(*FileErasableKVStore).filepath(s.keystoreKey())
	file, err := os.OpenFile(keypath, os.O_RDWR, 0755)
	defer file.Close()
	require.NoError(t, err)
	_, err = file.Write([]byte("YELLOW_SUBMARINE"))
	require.NoError(t, err)

	_, err = s.RetrieveSecret(mctx, alice)
	require.Error(t, err)
	requireError(t, err.(UnboxError), "msgpack decode error")

	err = s.ClearSecret(mctx, alice)
	require.NoError(t, err)
}

func TestSSSSCorruptNoise(t *testing.T) {
	t.Skip("Skipping secret service test while Linux CI AMI is being upgraded to include keyring")

	tc := SetupTest(t, "secret_store_secretservice", 0)
	defer tc.Cleanup()
	mctx := NewMetaContextForTest(tc)

	s := NewSecretStoreRevokableSecretService()
	err := s.StoreSecret(mctx, alice, secret())
	require.NoError(t, err)

	keystore := s.keystore(mctx, "alice", nil)
	fileKeystore := keystore.(*FileErasableKVStore)
	keypath := fileKeystore.filepath(fileKeystore.noiseKey(s.keystoreKey()))
	file, err := os.OpenFile(keypath, os.O_RDWR, 0755)
	defer file.Close()
	require.NoError(t, err)
	_, err = file.Write([]byte("YELLOW_SUBMARINE"))
	require.NoError(t, err)

	_, err = s.RetrieveSecret(mctx, alice)
	require.Error(t, err)
	require.Equal(t, err.(UnboxError).Info(), "noise hashes do not match")

	err = s.ClearSecret(mctx, alice)
	require.NoError(t, err)
}

func TestSSSSCorruptKeyring(t *testing.T) {
	t.Skip("Skipping secret service test while Linux CI AMI is being upgraded to include keyring")

	tc := SetupTest(t, "secret_store_secretservice", 0)
	defer tc.Cleanup()
	mctx := NewMetaContextForTest(tc)

	s := NewSecretStoreRevokableSecretService()

	err := s.StoreSecret(mctx, alice, secret())
	require.NoError(t, err)

	srv, err := secsrv.NewService()
	require.NoError(t, err)
	session, err := srv.OpenSession(secsrv.AuthenticationDHAES)
	require.NoError(t, err)
	defer srv.CloseSession(session)
	identifierKeystore := s.identifierKeystore(mctx)
	var instanceIdentifier []byte
	err = identifierKeystore.Get(mctx, s.identifierKeystoreKey("alice"), &instanceIdentifier)
	require.NoError(t, err)
	label := fmt.Sprintf("%s@%s", "alice", mctx.G().Env.GetStoredSecretServiceName())
	properties := secsrv.NewSecretProperties(label, s.makeAttributes(mctx, "alice", instanceIdentifier))
	srvSecret, err := session.NewSecret([]byte("NOT_THE_REAL_SECRET"))
	require.NoError(t, err)
	_, err = srv.CreateItem(secsrv.DefaultCollection, properties, srvSecret, secsrv.ReplaceBehaviorReplace)
	require.NoError(t, err)

	_, err = s.RetrieveSecret(mctx, alice)
	require.Error(t, err)
	require.Equal(t, err.(UnboxError).Info(), "noise hashes match")
	// (i.e., issue is something else - likely a MAC mismatch, but secretbox.Open doesn't give a more specific error)

	err = s.ClearSecret(mctx, alice)
	require.NoError(t, err)
}
