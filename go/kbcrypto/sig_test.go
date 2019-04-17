// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcrypto

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"github.com/keybase/go-crypto/ed25519"
	"github.com/stretchr/testify/require"
	"testing"
)

type keypair struct {
	pub  NaclSigningKeyPublic
	priv NaclSigningKeyPrivate
}

func makeKeypair() (keypair, error) {
	reader := rand.Reader
	publicKey, privateKey, err := ed25519.GenerateKey(reader)
	var ret keypair
	if err != nil {
		return ret, err
	}
	copy(ret.pub[:], publicKey)
	copy(ret.priv[:], privateKey)

	return ret, nil
}

func TestVerifyWithPayload(t *testing.T) {
	kp, err := makeKeypair()
	require.NoError(t, err)

	msg := []byte("let there be songs / to fill the air")

	sig, _, err := kp.priv.SignToStringV0(msg, kp.pub)
	require.NoError(t, err)

	requireError := func(err error, s string) {
		require.Error(t, err)
		require.Equal(t, errors.New(s), err.(VerificationError).Cause)
	}

	_, _, err = NaclVerifyWithPayload(sig, msg)
	require.NoError(t, err)
	_, _, err = NaclVerifyWithPayload(sig, nil)
	requireError(err, "nil payload")
	_, _, err = NaclVerifyWithPayload(sig, []byte(""))
	requireError(err, "empty payload")
	_, _, err = NaclVerifyWithPayload(sig, []byte("yo"))
	requireError(err, "payload mismatch")

	info := kp.priv.SignInfoV0(msg, kp.pub)
	info.Payload = nil
	body, err := EncodePacketToBytes(&info)
	require.NoError(t, err)
	sig = base64.StdEncoding.EncodeToString(body)

	_, _, err = NaclVerifyWithPayload(sig, msg)
	require.NoError(t, err)

	// Now corrupt and make sure we get the right answer
	info.Sig[10] ^= 0x1
	body, err = EncodePacketToBytes(&info)
	require.NoError(t, err)
	sig = base64.StdEncoding.EncodeToString(body)
	_, _, err = NaclVerifyWithPayload(sig, msg)
	requireError(err, "verify failed")

	// Get the same failure if we have the wrong sig and the wrong payload
	_, _, err = NaclVerifyWithPayload(sig, []byte("yo"))
	requireError(err, "verify failed")

	// Fail with bad payload before the sig fails, if we have the right payload and it's doubled up
	info.Payload = msg
	body, err = EncodePacketToBytes(&info)
	require.NoError(t, err)
	sig = base64.StdEncoding.EncodeToString(body)
	_, _, err = NaclVerifyWithPayload(sig, []byte("yo"))
	requireError(err, "payload mismatch")
}
