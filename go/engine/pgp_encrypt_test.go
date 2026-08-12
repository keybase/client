// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"bytes"
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func TestPGPEncrypt(t *testing.T) {
	tc := SetupEngineTest(t, "PGPEncrypt")
	defer tc.Cleanup()

	u := createFakeUserWithPGPSibkey(tc)
	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	uis := libkb.UIs{
		IdentifyUI: trackUI,
		PgpUI:      &TestPgpUI{},
		SecretUI:   u.NewSecretUI(),
	}

	sink := libkb.NewBufferCloser()
	arg := &PGPEncryptArg{
		Recips: []string{"t_alice", "t_bob+kbtester1@twitter", "t_charlie+tacovontaco@twitter"},
		Source: strings.NewReader("track and encrypt, track and encrypt"),
		Sink:   sink,
		NoSign: true,
	}

	eng := NewPGPEncrypt(tc.G, arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
		require.NoError(t, err)
	}

	out := sink.Bytes()
	require.NotEmpty(t, out, "no output")
}

func TestPGPEncryptNoPGPNaClOnly(t *testing.T) {
	tc := SetupEngineTest(t, "TestPGPEncryptNoPGPNaClOnly")
	defer tc.Cleanup()

	u1 := CreateAndSignupFakeUser(tc, "nalcp")
	Logout(tc)
	u2 := createFakeUserWithPGPSibkey(tc)
	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	uis := libkb.UIs{
		IdentifyUI: trackUI,
		PgpUI:      &TestPgpUI{},
		SecretUI:   u2.NewSecretUI(),
	}

	sink := libkb.NewBufferCloser()
	arg := &PGPEncryptArg{
		Recips: []string{u1.Username},
		Source: strings.NewReader("track and encrypt, track and encrypt"),
		Sink:   sink,
		NoSign: true,
	}

	eng := NewPGPEncrypt(tc.G, arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
	if perr, ok := err.(libkb.NoPGPEncryptionKeyError); !ok {
		require.True(t, ok,
			"Got wrong error type: %T %v", err, err)
	} else if !perr.HasKeybaseEncryptionKey {
		require.True(t, perr.HasKeybaseEncryptionKey,
			"Should have a keybase encryption key")
	} else if perr.User != u1.Username {
		require.FailNow(t, "Wrong username")
	}
}

func TestPGPEncryptSelfNoKey(t *testing.T) {
	tc := SetupEngineTest(t, "PGPEncrypt")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")
	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	uis := libkb.UIs{
		IdentifyUI: trackUI,
		PgpUI:      &TestPgpUI{},
		SecretUI:   u.NewSecretUI(),
	}

	sink := libkb.NewBufferCloser()
	arg := &PGPEncryptArg{
		Recips: []string{"t_alice", "t_bob+twitter:kbtester1", "t_charlie+twitter:tacovontaco"},
		Source: strings.NewReader("track and encrypt, track and encrypt"),
		Sink:   sink,
		NoSign: true,
	}

	eng := NewPGPEncrypt(tc.G, arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
	require.Error(t, err,
		"no error encrypting for self without pgp key")
	if _, ok := err.(libkb.NoKeyError); !ok {
		require.True(t, ok,
			"expected error type libkb.NoKeyError, got %T (%s)", err, err)
	}
}

func TestPGPEncryptNoTrack(t *testing.T) {
	tc := SetupEngineTest(t, "PGPEncrypt")
	defer tc.Cleanup()

	u := createFakeUserWithPGPSibkey(tc)
	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	uis := libkb.UIs{
		IdentifyUI: trackUI,
		PgpUI:      &TestPgpUI{},
		SecretUI:   u.NewSecretUI(),
	}

	sink := libkb.NewBufferCloser()
	arg := &PGPEncryptArg{
		Recips: []string{"t_alice", "t_bob+kbtester1@twitter", "t_charlie+tacovontaco@twitter"},
		Source: strings.NewReader("identify and encrypt, identify and encrypt"),
		Sink:   sink,
		NoSign: true,
	}

	eng := NewPGPEncrypt(tc.G, arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
		require.NoError(t, err)
	}

	out := sink.Bytes()
	require.NotEmpty(t, out, "no output")

	assertNotTracking(tc, "t_alice")
	assertNotTracking(tc, "t_bob")
	assertNotTracking(tc, "t_charlie")
}

// encrypt for self via NoSelf: false and username in recipients
func TestPGPEncryptSelfTwice(t *testing.T) {
	tc := SetupEngineTest(t, "PGPEncrypt")
	defer tc.Cleanup()

	u := createFakeUserWithPGPSibkey(tc)
	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
	}
	uis := libkb.UIs{
		IdentifyUI: trackUI,
		PgpUI:      &TestPgpUI{},
		SecretUI:   u.NewSecretUI(),
	}

	msg := "encrypt for self only once"
	sink := libkb.NewBufferCloser()
	arg := &PGPEncryptArg{
		Recips: []string{u.Username},
		Source: strings.NewReader(msg),
		Sink:   sink,
		NoSign: true,
	}

	eng := NewPGPEncrypt(tc.G, arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
	require.NoError(t, err)
	out := sink.Bytes()

	// decrypt it
	decoded := libkb.NewBufferCloser()
	decarg := &PGPDecryptArg{
		Source: bytes.NewReader(out),
		Sink:   decoded,
	}
	dec := NewPGPDecrypt(tc.G, decarg)
	m = m.WithLogUI(tc.G.UI.GetLogUI()).WithPgpUI(&TestPgpUI{})
	if err := RunEngine2(m, dec); err != nil {
		require.NoError(t, err)
	}
	decmsg := decoded.String()
	require.Equal(t, msg, decmsg, "decoded: %q, expected: %q", decmsg, msg)

	recips := dec.signStatus.RecipientKeyIDs
	if len(recips) != 1 {
		t.Logf("recipient key ids: %v", recips)
		require.Fail(t, "num recipient key ids: %d, expected 1", len(recips))
	}
}
