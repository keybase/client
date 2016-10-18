package chat

// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

import (
	"crypto/sha256"
	"strings"
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
	return chat1.MessagePlaintext{
		ClientHeader: header,
		MessageBody:  chat1.NewMessageBodyWithText(chat1.MessageText{Body: text}),
	}
}

func setupChatTest(t *testing.T, name string) (libkb.TestContext, *Boxer) {
	tc := externals.SetupTest(t, name, 2)
	return tc, NewBoxer(tc.G, nil)
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
	tc, boxer := setupChatTest(t, "box")
	defer tc.Cleanup()
	boxed, err := boxer.boxMessageWithKeysV1(msg, key, getSigningKeyPairForTest(t, tc, nil))
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
	tc, boxer := setupChatTest(t, "unbox")
	defer tc.Cleanup()

	// need a real user
	u, err := kbtest.CreateAndSignupFakeUser("unbox", tc.G)
	if err != nil {
		t.Fatal(err)
	}
	msg := textMsgWithSender(t, text, gregor1.UID(u.User.GetUID().ToBytes()))

	signKP := getSigningKeyPairForTest(t, tc, u)

	boxed, err := boxer.boxMessageWithKeysV1(msg, key, signKP)
	if err != nil {
		t.Fatal(err)
	}

	// need to give it a server header...
	boxed.ServerHeader = &chat1.MessageServerHeader{
		Ctime: gregor1.ToTime(time.Now()),
	}

	messagePlaintext, _, err := boxer.unboxMessageWithKey(context.TODO(), *boxed, key)
	if err != nil {
		t.Fatal(err)
	}
	body := messagePlaintext.MessageBody
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
	tc, boxer := setupChatTest(t, "unbox")
	defer tc.Cleanup()

	// need a real user
	u, err := kbtest.CreateAndSignupFakeUser("unbox", tc.G)
	if err != nil {
		t.Fatal(err)
	}
	msg := textMsgWithSender(t, text, gregor1.UID(u.User.GetUID().ToBytes()))

	signKP := getSigningKeyPairForTest(t, tc, u)

	origHashFn := boxer.hashV1
	boxer.hashV1 = func(data []byte) chat1.Hash {
		data = append(data, []byte{1, 2, 3}...)
		sum := sha256.Sum256(data)
		return sum[:]
	}

	boxed, err := boxer.boxMessageWithKeysV1(msg, key, signKP)
	if err != nil {
		t.Fatal(err)
	}

	// need to give it a server header...
	boxed.ServerHeader = &chat1.MessageServerHeader{
		Ctime: gregor1.ToTime(time.Now()),
	}

	// put original hash fn back
	boxer.hashV1 = origHashFn

	_, _, ierr := boxer.unboxMessageWithKey(context.TODO(), *boxed, key)
	if _, ok := ierr.Inner().(libkb.ChatBodyHashInvalid); !ok {
		t.Fatalf("unexpected error for invalid body hash: %s", ierr)
	}
}

func TestChatMessageUnboxInvalidBodyHash(t *testing.T) {
	tc, boxer := setupChatTest(t, "unbox")
	defer tc.Cleanup()

	u, err := kbtest.CreateAndSignupFakeUser("unbox", tc.G)
	if err != nil {
		t.Fatal(err)
	}

	world := kbtest.NewChatMockWorld(t, "unbox", 4)
	boxer.tlf = kbtest.NewTlfMock(world)

	header := chat1.MessageClientHeader{
		Sender:    gregor1.UID(u.User.GetUID().ToBytes()),
		TlfPublic: true,
		TlfName:   "hi",
	}
	text := "hi"
	msg := textMsgWithHeader(t, text, header)

	signKP := getSigningKeyPairForTest(t, tc, u)

	ctx := context.Background()

	origHashFn := boxer.hashV1
	boxer.hashV1 = func(data []byte) chat1.Hash {
		data = append(data, []byte{1, 2, 3}...)
		sum := sha256.Sum256(data)
		return sum[:]
	}

	boxed, err := boxer.BoxMessage(ctx, msg, signKP)
	if err != nil {
		t.Fatal(err)
	}

	// need to give it a server header...
	boxed.ServerHeader = &chat1.MessageServerHeader{
		Ctime: gregor1.ToTime(time.Now()),
	}

	// put original hash fn back
	boxer.hashV1 = origHashFn

	// This should produce a permanent error. So err will be nil, but the decmsg will be state=error.
	decmsg, err := boxer.UnboxMessage(ctx, NewKeyFinder(), *boxed)
	if err != nil {
		t.Fatal(err)
	}
	if decmsg.IsValid() {
		t.Fatalf("message should not be unboxable")
	}
}

func TestChatMessageUnboxNoCryptKey(t *testing.T) {
	tc, boxer := setupChatTest(t, "unbox")
	defer tc.Cleanup()

	u, err := kbtest.CreateAndSignupFakeUser("unbox", tc.G)
	if err != nil {
		t.Fatal(err)
	}

	world := kbtest.NewChatMockWorld(t, "unbox", 4)
	boxer.tlf = kbtest.NewTlfMock(world)

	header := chat1.MessageClientHeader{
		Sender:    gregor1.UID(u.User.GetUID().ToBytes()),
		TlfPublic: true,
		TlfName:   "hi",
	}
	text := "hi"
	msg := textMsgWithHeader(t, text, header)

	signKP := getSigningKeyPairForTest(t, tc, u)

	ctx := context.Background()

	boxed, err := boxer.BoxMessage(ctx, msg, signKP)
	if err != nil {
		t.Fatal(err)
	}

	// need to give it a server header...
	boxed.ServerHeader = &chat1.MessageServerHeader{
		Ctime: gregor1.ToTime(time.Now()),
	}

	// This should produce a non-permanent error. So err will be set.
	decmsg, ierr := boxer.UnboxMessage(ctx, NewKeyFinderMock(), *boxed)
	if !strings.Contains(ierr.Error(), "no key found") {
		t.Fatalf("error should contain 'no key found': %v", ierr)
	}
	if decmsg.IsValid() {
		t.Fatalf("message should not be unboxable")
	}
}
func TestChatMessageInvalidHeaderSig(t *testing.T) {
	key := cryptKey(t)
	text := "hi"
	tc, boxer := setupChatTest(t, "unbox")
	defer tc.Cleanup()

	// need a real user
	u, err := kbtest.CreateAndSignupFakeUser("unbox", tc.G)
	if err != nil {
		t.Fatal(err)
	}
	msg := textMsgWithSender(t, text, gregor1.UID(u.User.GetUID().ToBytes()))

	signKP := getSigningKeyPairForTest(t, tc, u)

	origSign := boxer.sign
	boxer.sign = func(msg []byte, kp libkb.NaclSigningKeyPair, prefix libkb.SignaturePrefix) (chat1.SignatureInfo, error) {
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

	boxed, err := boxer.boxMessageWithKeysV1(msg, key, signKP)
	if err != nil {
		t.Fatal(err)
	}

	// need to give it a server header...
	boxed.ServerHeader = &chat1.MessageServerHeader{
		Ctime: gregor1.ToTime(time.Now()),
	}

	// put original signing fn back
	boxer.sign = origSign

	_, _, ierr := boxer.unboxMessageWithKey(context.TODO(), *boxed, key)
	if _, ok := ierr.Inner().(libkb.BadSigError); !ok {
		t.Fatalf("unexpected error for invalid header signature: %s", ierr)
	}
}

func TestChatMessageInvalidSenderKey(t *testing.T) {
	key := cryptKey(t)
	text := "hi"
	tc, boxer := setupChatTest(t, "unbox")
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

	boxed, err := boxer.boxMessageWithKeysV1(msg, key, signKP)
	if err != nil {
		t.Fatal(err)
	}

	boxed.ServerHeader = &chat1.MessageServerHeader{
		Ctime: gregor1.ToTime(time.Now()),
	}

	_, _, ierr := boxer.unboxMessageWithKey(context.TODO(), *boxed, key)
	if _, ok := ierr.Inner().(libkb.NoKeyError); !ok {
		t.Fatalf("unexpected error for invalid sender key: %v", ierr)
	}
}

func TestChatMessagePublic(t *testing.T) {
	text := "hi"
	tc, boxer := setupChatTest(t, "unbox")
	defer tc.Cleanup()

	// need a real user
	u, err := kbtest.CreateAndSignupFakeUser("unbox", tc.G)
	if err != nil {
		t.Fatal(err)
	}

	world := kbtest.NewChatMockWorld(t, "unbox", 4)
	boxer.tlf = kbtest.NewTlfMock(world)

	header := chat1.MessageClientHeader{
		Sender:    gregor1.UID(u.User.GetUID().ToBytes()),
		TlfPublic: true,
		TlfName:   "hi",
	}
	msg := textMsgWithHeader(t, text, header)

	signKP := getSigningKeyPairForTest(t, tc, u)

	ctx := context.Background()

	boxed, err := boxer.BoxMessage(ctx, msg, signKP)
	if err != nil {
		t.Fatal(err)
	}
	_ = boxed

	// need to give it a server header...
	boxed.ServerHeader = &chat1.MessageServerHeader{
		Ctime: gregor1.ToTime(time.Now()),
	}

	decmsg, err := boxer.UnboxMessage(ctx, NewKeyFinder(), *boxed)
	if err != nil {
		t.Fatal(err)
	}
	if !decmsg.IsValid() {
		t.Fatalf("decmsg is not valid")
	}
	body := decmsg.Valid().MessageBody
	if typ, _ := body.MessageType(); typ != chat1.MessageType_TEXT {
		t.Errorf("body type: %d, expected %d", typ, chat1.MessageType_TEXT)
	}
	if body.Text().Body != text {
		t.Errorf("body text: %q, expected %q", body.Text().Body, text)
	}
}

type KeyFinderMock struct{}

func NewKeyFinderMock() KeyFinder {
	return &KeyFinderMock{}
}

func (k *KeyFinderMock) Find(ctx context.Context, tlf keybase1.TlfInterface, tlfName string, tlfPublic bool) (keybase1.GetTLFCryptKeysRes, error) {
	return keybase1.GetTLFCryptKeysRes{}, nil
}
