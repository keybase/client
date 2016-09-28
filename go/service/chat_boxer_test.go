package service

// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

import (
	"crypto/sha256"
	"testing"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
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

func textMsg(t *testing.T, text string) chat1.MessagePlaintext {
	uid, err := libkb.RandBytes(16)
	if err != nil {
		t.Fatal(err)
	}
	uid[15] = keybase1.UID_SUFFIX_2
	return textMsgWithSender(t, text, gregor1.UID(uid))
}

func textMsgWithSender(t *testing.T, text string, uid gregor1.UID) chat1.MessagePlaintext {
	header := chat1.MessageClientHeader{
		Sender: uid,
	}
	return textMsgWithHeader(t, text, header)
}

func textMsgWithHeader(t *testing.T, text string, header chat1.MessageClientHeader) chat1.MessagePlaintext {
	return chat1.NewMessagePlaintextWithV1(chat1.MessagePlaintextV1{
		ClientHeader: header,
		MessageBody:  chat1.NewMessageBodyWithText(chat1.MessageText{Body: text}),
	})
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
	boxed, err := handler.boxer.boxMessageWithKeysV1(msg.V1(), key, getSigningKeyPairForTest(t, tc, nil))
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
	tc, handler := setupChatTest(t, "unbox")
	defer tc.Cleanup()

	// need a real user
	u, err := kbtest.CreateAndSignupFakeUser("unbox", tc.G)
	if err != nil {
		t.Fatal(err)
	}
	msg := textMsgWithSender(t, text, gregor1.UID(u.User.GetUID().ToBytes()))

	signKP := getSigningKeyPairForTest(t, tc, u)

	boxed, err := handler.boxer.boxMessageWithKeysV1(msg.V1(), key, signKP)
	if err != nil {
		t.Fatal(err)
	}

	// need to give it a server header...
	boxed.ServerHeader = &chat1.MessageServerHeader{
		Ctime: gregor1.ToTime(time.Now()),
	}

	unboxed, err := handler.boxer.unboxMessageWithKey(context.TODO(), *boxed, key)
	if err != nil {
		t.Fatal(err)
	}
	body := unboxed.MessagePlaintext.V1().MessageBody
	if typ, _ := body.MessageType(); typ != chat1.MessageType_TEXT {
		t.Errorf("body type: %d, expected %d", typ, chat1.MessageType_TEXT)
	}
	if body.Text().Body != text {
		t.Errorf("body text: %q, expected %q", body.Text().Body, text)
	}
}

func TestChatMessageInvalidBodyHash(t *testing.T) {
	key := cryptKey(t)
	text := "hi"
	tc, handler := setupChatTest(t, "unbox")
	defer tc.Cleanup()

	// need a real user
	u, err := kbtest.CreateAndSignupFakeUser("unbox", tc.G)
	if err != nil {
		t.Fatal(err)
	}
	msg := textMsgWithSender(t, text, gregor1.UID(u.User.GetUID().ToBytes()))

	signKP := getSigningKeyPairForTest(t, tc, u)

	origHashFn := handler.boxer.hashV1
	handler.boxer.hashV1 = func(data []byte) chat1.Hash {
		data = append(data, []byte{1, 2, 3}...)
		sum := sha256.Sum256(data)
		return sum[:]
	}

	boxed, err := handler.boxer.boxMessageWithKeysV1(msg.V1(), key, signKP)
	if err != nil {
		t.Fatal(err)
	}

	// need to give it a server header...
	boxed.ServerHeader = &chat1.MessageServerHeader{
		Ctime: gregor1.ToTime(time.Now()),
	}

	// put original hash fn back
	handler.boxer.hashV1 = origHashFn

	_, err = handler.boxer.unboxMessageWithKey(context.TODO(), *boxed, key)
	if _, ok := err.(libkb.ChatBodyHashInvalid); !ok {
		t.Fatalf("unexpected error for invalid body hash: %s", err)
	}
}

func TestChatMessageInvalidHeaderSig(t *testing.T) {
	key := cryptKey(t)
	text := "hi"
	tc, handler := setupChatTest(t, "unbox")
	defer tc.Cleanup()

	// need a real user
	u, err := kbtest.CreateAndSignupFakeUser("unbox", tc.G)
	if err != nil {
		t.Fatal(err)
	}
	msg := textMsgWithSender(t, text, gregor1.UID(u.User.GetUID().ToBytes()))

	signKP := getSigningKeyPairForTest(t, tc, u)

	origSign := handler.boxer.sign
	handler.boxer.sign = func(msg []byte, kp libkb.NaclSigningKeyPair, prefix libkb.SignaturePrefix) (chat1.SignatureInfo, error) {
		sig, err := kp.SignV2(msg, prefix)
		if err != nil {
			return chat1.SignatureInfo{}, err
		}
		sigInfo := chat1.SignatureInfo{
			V: sig.Version,
			S: sig.Sig[:],
			K: sig.Kid,
		}
		// flip bits
		sigInfo.S[4] ^= 0x10
		return sigInfo, nil
	}

	boxed, err := handler.boxer.boxMessageWithKeysV1(msg.V1(), key, signKP)
	if err != nil {
		t.Fatal(err)
	}

	// need to give it a server header...
	boxed.ServerHeader = &chat1.MessageServerHeader{
		Ctime: gregor1.ToTime(time.Now()),
	}

	// put original signing fn back
	handler.boxer.sign = origSign

	_, err = handler.boxer.unboxMessageWithKey(context.TODO(), *boxed, key)
	if _, ok := err.(libkb.BadSigError); !ok {
		t.Fatalf("unexpected error for invalid header signature: %s", err)
	}
}

func TestChatMessageInvalidSenderKey(t *testing.T) {
	key := cryptKey(t)
	text := "hi"
	tc, handler := setupChatTest(t, "unbox")
	defer tc.Cleanup()

	// need a real user
	u, err := kbtest.CreateAndSignupFakeUser("unbox", tc.G)
	if err != nil {
		t.Fatal(err)
	}
	msg := textMsgWithSender(t, text, gregor1.UID(u.User.GetUID().ToBytes()))

	// use a random signing key, not one of u's keys
	signKP, err := libkb.GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	boxed, err := handler.boxer.boxMessageWithKeysV1(msg.V1(), key, signKP)
	if err != nil {
		t.Fatal(err)
	}

	boxed.ServerHeader = &chat1.MessageServerHeader{
		Ctime: gregor1.ToTime(time.Now()),
	}

	_, err = handler.boxer.unboxMessageWithKey(context.TODO(), *boxed, key)
	if _, ok := err.(libkb.NoKeyError); !ok {
		t.Fatalf("unexpected error for invalid sender key: %v", err)
	}
}

func TestChatMessagePublic(t *testing.T) {
	text := "hi"
	tc, handler := setupChatTest(t, "unbox")
	defer tc.Cleanup()

	// need a real user
	u, err := kbtest.CreateAndSignupFakeUser("unbox", tc.G)
	if err != nil {
		t.Fatal(err)
	}

	world := newChatMockWorld(t, "unbox", 4)
	handler.boxer.tlf = newTlfMock(world)

	header := chat1.MessageClientHeader{
		Sender:    gregor1.UID(u.User.GetUID().ToBytes()),
		TlfPublic: true,
	}
	msg := textMsgWithHeader(t, text, header)

	signKP := getSigningKeyPairForTest(t, tc, u)

	ctx := context.Background()

	boxed, err := handler.boxer.boxMessageV1(ctx, msg.V1(), signKP)
	if err != nil {
		t.Fatal(err)
	}
	_ = boxed

	// need to give it a server header...
	boxed.ServerHeader = &chat1.MessageServerHeader{
		Ctime: gregor1.ToTime(time.Now()),
	}

	unboxed, err := handler.boxer.unboxMessage(ctx, newKeyFinder(), *boxed)
	if err != nil {
		t.Fatal(err)
	}
	body := unboxed.MessagePlaintext.V1().MessageBody
	if typ, _ := body.MessageType(); typ != chat1.MessageType_TEXT {
		t.Errorf("body type: %d, expected %d", typ, chat1.MessageType_TEXT)
	}
	if body.Text().Body != text {
		t.Errorf("body text: %q, expected %q", body.Text().Body, text)
	}
}
