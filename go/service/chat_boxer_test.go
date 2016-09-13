package service

// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

import (
	"testing"
	"time"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func cryptKey(t *testing.T) *keybase1.CryptKey {
	kp, err := libkb.GenerateNaclDHKeyPair()
	if err != nil {
		t.Fatal(err)
	}
	return &keybase1.CryptKey{
		KeyGeneration: 1,
		Key:           keybase1.Bytes32(*kp.Private),
	}
}

func textMsg(t *testing.T, text string) keybase1.MessagePlaintext {
	uid, err := libkb.RandBytes(16)
	if err != nil {
		t.Fatal(err)
	}
	uid[15] = keybase1.UID_SUFFIX_2
	return keybase1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Sender: gregor1.UID(uid),
		},
		MessageBodies: []keybase1.MessageBody{
			keybase1.NewMessageBodyWithText(keybase1.MessageText{Body: text}),
		},
	}
}

func setupChatTest(t *testing.T, name string) (libkb.TestContext, *chatLocalHandler) {
	tc := externals.SetupTest(t, name, 2)
	handler := &chatLocalHandler{
		boxer: newChatBoxer(tc.G),
	}
	return tc, handler
}

func getSigningKeyPairForTest(t *testing.T, tc libkb.TestContext, u *kbtest.FakeUser) libkb.NaclSigningKeyPair {
	var err error
	if u == nil {
		u, err = kbtest.CreateAndSignupFakeUser("unbox", tc.G)
		if err != nil {
			t.Fatal(err)
		}
	}
	kp, err := tc.G.Keyrings.GetSecretKeyWithPassphrase(nil, u.User, u.Passphrase, nil)
	if err != nil {
		t.Fatal(err)
	}
	signKP, ok := kp.(libkb.NaclSigningKeyPair)
	if !ok {
		t.Fatal("signing key not nacl")
	}
	return signKP
}

func TestChatMessageBox(t *testing.T) {
	key := cryptKey(t)
	msg := textMsg(t, "hello")
	tc, handler := setupChatTest(t, "box")
	defer tc.Cleanup()
	boxed, err := handler.boxer.boxMessageWithKeys(msg, key, getSigningKeyPairForTest(t, tc, nil))
	if err != nil {
		t.Fatal(err)
	}
	if len(boxed.BodyCiphertext.E) == 0 {
		t.Error("after boxMessage, BodyCipherText.E is empty")
	}
}

func TestChatMessageUnbox(t *testing.T) {
	key := cryptKey(t)
	text := "hi"
	msg := textMsg(t, text)
	tc, handler := setupChatTest(t, "unbox")
	defer tc.Cleanup()

	// need a real user
	u, err := kbtest.CreateAndSignupFakeUser("unbox", tc.G)
	if err != nil {
		t.Fatal(err)
	}
	msg.ClientHeader.Sender = gregor1.UID(u.User.GetUID().ToBytes())

	signKP := getSigningKeyPairForTest(t, tc, u)

	ctime := time.Now()
	boxed, err := handler.boxer.boxMessageWithKeys(msg, key, signKP)
	if err != nil {
		t.Fatal(err)
	}

	// need to give it a server header...
	boxed.ServerHeader = &chat1.MessageServerHeader{
		Ctime: gregor1.ToTime(ctime),
	}

	unboxed, err := handler.boxer.unboxMessageWithKey(boxed, key)
	if err != nil {
		t.Fatal(err)
	}
	if len(unboxed.MessagePlaintext.MessageBodies) != 1 {
		t.Fatalf("unboxed message bodies: %d, expected 1", len(unboxed.MessagePlaintext.MessageBodies))
	}
	body := unboxed.MessagePlaintext.MessageBodies[0]
	if typ, _ := body.MessageType(); typ != chat1.MessageType_TEXT {
		t.Errorf("body type: %d, expected %d", typ, chat1.MessageType_TEXT)
	}
	if body.Text().Body != text {
		t.Errorf("body text: %q, expected %q", body.Text().Body, text)
	}
}

func TestChatMessageSigned(t *testing.T) {
	key := cryptKey(t)
	msg := textMsg(t, "sign me")
	tc, handler := setupChatTest(t, "signed")
	defer tc.Cleanup()
	boxed, err := handler.boxer.boxMessageWithKeys(msg, key, getSigningKeyPairForTest(t, tc, nil))
	if err != nil {
		t.Fatal(err)
	}
	if boxed.HeaderSignature.V != 2 {
		t.Errorf("HeaderSignature.V = %d, expected 2", boxed.HeaderSignature.V)
	}
	if len(boxed.HeaderSignature.S) == 0 {
		t.Error("after signMessageBoxed, HeaderSignature.S is empty")
	}
	if len(boxed.HeaderSignature.K) == 0 {
		t.Error("after signMessageBoxed, HeaderSignature.K is empty")
	}
	if boxed.BodySignature.V != 2 {
		t.Errorf("BodySignature.V = %d, expected 2", boxed.BodySignature.V)
	}
	if len(boxed.BodySignature.S) == 0 {
		t.Error("after signMessageBoxed, BodySignature.S is empty")
	}
	if len(boxed.BodySignature.K) == 0 {
		t.Error("after signMessageBoxed, BodySignature.K is empty")
	}
}
