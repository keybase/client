package chat

// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

import (
	"crypto/sha256"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/signencrypt"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
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

func setupChatTest(t *testing.T, name string) (*kbtest.ChatTestContext, *Boxer) {
	tc := externals.SetupTest(t, name, 2)
	ctc := kbtest.ChatTestContext{
		TestContext: tc,
		ChatG:       &globals.ChatContext{},
	}
	return &ctc, NewBoxer(ctc.Context())
}

func getSigningKeyPairForTest(t *testing.T, tc *kbtest.ChatTestContext, u *kbtest.FakeUser) libkb.NaclSigningKeyPair {
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

func getActiveDevicesAndKeys(tc *kbtest.ChatTestContext, u *kbtest.FakeUser) ([]*libkb.Device, []libkb.GenericKey) {
	arg := libkb.NewLoadUserByNameArg(tc.G, u.Username)
	arg.PublicKeyOptional = true
	user, err := libkb.LoadUser(arg)
	if err != nil {
		tc.T.Fatal(err)
	}
	sibkeys := user.GetComputedKeyFamily().GetAllActiveSibkeys()
	subkeys := user.GetComputedKeyFamily().GetAllActiveSubkeys()

	activeDevices := []*libkb.Device{}
	for _, device := range user.GetComputedKeyFamily().GetAllDevices() {
		if device.Status != nil && *device.Status == libkb.DeviceStatusActive {
			activeDevices = append(activeDevices, device)
		}
	}
	return activeDevices, append(sibkeys, subkeys...)
}

func doRevokeDevice(tc *kbtest.ChatTestContext, u *kbtest.FakeUser, id keybase1.DeviceID, force bool) error {
	revokeEngine := engine.NewRevokeDeviceEngine(engine.RevokeDeviceEngineArgs{ID: id, Force: force}, tc.G)
	ctx := &engine.Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: u.NewSecretUI(),
	}
	err := engine.RunEngine(revokeEngine, ctx)
	return err
}

func doWithMBVersions(f func(chat1.MessageBoxedVersion)) {
	f(chat1.MessageBoxedVersion_V1)
	f(chat1.MessageBoxedVersion_V2)
}

func TestChatMessageBox(t *testing.T) {
	doWithMBVersions(func(mbVersion chat1.MessageBoxedVersion) {
		key := cryptKey(t)
		msg := textMsg(t, "hello")
		tc, boxer := setupChatTest(t, "box")
		defer tc.Cleanup()
		boxed, err := boxer.box(msg, key, getSigningKeyPairForTest(t, tc, nil), mbVersion)
		if err != nil {
			t.Fatal(err)
		}
		require.Equal(t, mbVersion, boxed.Version)
		if len(boxed.BodyCiphertext.E) == 0 {
			t.Error("after boxMessage, BodyCipherText.E is empty")
		}
	})
}

func TestChatMessageUnbox(t *testing.T) {
	doWithMBVersions(func(mbVersion chat1.MessageBoxedVersion) {
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
		outboxID := chat1.OutboxID{0xdc, 0x74, 0x6, 0x5d, 0xf9, 0x5f, 0x1c, 0x48}
		msg.ClientHeader.OutboxID = &outboxID

		signKP := getSigningKeyPairForTest(t, tc, u)

		boxed, err := boxer.box(msg, key, signKP, mbVersion)
		require.NoError(t, err)
		boxed = remarshalBoxed(t, *boxed)

		if boxed.ClientHeader.OutboxID == msg.ClientHeader.OutboxID {
			t.Fatalf("defective test: %+v   ==   %+v", boxed.ClientHeader.OutboxID, msg.ClientHeader.OutboxID)
		}

		// need to give it a server header...
		boxed.ServerHeader = &chat1.MessageServerHeader{
			Ctime: gregor1.ToTime(time.Now()),
		}

		unboxed, err := boxer.unbox(context.TODO(), *boxed, key)
		if err != nil {
			t.Fatal(err)
		}
		body := unboxed.MessageBody
		if typ, _ := body.MessageType(); typ != chat1.MessageType_TEXT {
			t.Errorf("body type: %d, expected %d", typ, chat1.MessageType_TEXT)
		}
		if body.Text().Body != text {
			t.Errorf("body text: %q, expected %q", body.Text().Body, text)
		}
		require.Nil(t, unboxed.SenderDeviceRevokedAt, "message should not be from revoked device")
		require.NotNil(t, unboxed.BodyHash)
	})
}

func TestChatMessageMissingOutboxID(t *testing.T) {
	// Test with an outbox ID missing.
	mbVersion := chat1.MessageBoxedVersion_V2
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
	outboxID := chat1.OutboxID{0xdc, 0x74, 0x6, 0x5d, 0xf9, 0x5f, 0x1c, 0x48}
	msg.ClientHeader.OutboxID = &outboxID

	signKP := getSigningKeyPairForTest(t, tc, u)

	boxed, err := boxer.box(msg, key, signKP, mbVersion)
	require.NoError(t, err)
	boxed = remarshalBoxed(t, *boxed)

	if boxed.ClientHeader.OutboxID == msg.ClientHeader.OutboxID {
		t.Fatalf("defective test: %+v   ==   %+v", boxed.ClientHeader.OutboxID, msg.ClientHeader.OutboxID)
	}

	// omit outbox id
	boxed.ClientHeader.OutboxID = nil

	// need to give it a server header...
	boxed.ServerHeader = &chat1.MessageServerHeader{
		Ctime: gregor1.ToTime(time.Now()),
	}

	_, uberr := boxer.unbox(context.TODO(), *boxed, key)
	require.Error(t, uberr)
	ierr, ok := uberr.Inner().(HeaderMismatchError)
	require.True(t, ok, "unexpected error: %T -> %T -> %v", uberr, uberr.Inner(), uberr)
	require.Equal(t, "OutboxID", ierr.Field)
}

func TestChatMessageInvalidBodyHash(t *testing.T) {
	doWithMBVersions(func(mbVersion chat1.MessageBoxedVersion) {
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

		boxed, err := boxer.box(msg, key, signKP, mbVersion)
		if err != nil {
			t.Fatal(err)
		}

		// need to give it a server header...
		boxed.ServerHeader = &chat1.MessageServerHeader{
			Ctime: gregor1.ToTime(time.Now()),
		}

		// put original hash fn back
		boxer.hashV1 = origHashFn

		_, ierr := boxer.unbox(context.TODO(), *boxed, key)
		if _, ok := ierr.Inner().(BodyHashInvalid); !ok {
			t.Fatalf("unexpected error for invalid body hash: %s", ierr)
		}
	})
}

func TestChatMessageUnboxInvalidBodyHash(t *testing.T) {
	doWithMBVersions(func(mbVersion chat1.MessageBoxedVersion) {
		tc, boxer := setupChatTest(t, "unbox")
		defer tc.Cleanup()

		world := NewChatMockWorld(t, "unbox", 4)
		u := world.GetUsers()[0]
		tc = world.Tcs[u.Username]
		uid := u.User.GetUID().ToBytes()
		tlf := kbtest.NewTlfMock(world)
		ctx := newTestContextWithTlfMock(tc, tlf)

		header := chat1.MessageClientHeader{
			Sender:    uid,
			TlfPublic: false,
			TlfName:   u.Username,
		}
		text := "hi"
		msg := textMsgWithHeader(t, text, header)

		signKP := getSigningKeyPairForTest(t, tc, u)

		origHashFn := boxer.hashV1
		boxer.hashV1 = func(data []byte) chat1.Hash {
			data = append(data, []byte{1, 2, 3}...)
			sum := sha256.Sum256(data)
			return sum[:]
		}

		boxer.boxWithVersion = mbVersion
		boxed, err := boxer.BoxMessage(ctx, msg, chat1.ConversationMembersType_KBFS, signKP)
		if err != nil {
			t.Fatal(err)
		}

		// need to give it a server header...
		boxed.ServerHeader = &chat1.MessageServerHeader{
			Ctime: gregor1.ToTime(time.Now()),
		}

		// put original hash fn back
		boxer.hashV1 = origHashFn

		// NOTE: this is hashing a lot of zero values, and it might break when we add more checks
		convID := header.Conv.ToConversationID([2]byte{0, 0})
		conv := chat1.Conversation{
			Metadata: chat1.ConversationMetadata{
				ConversationID: convID,
			},
		}

		// This should produce a permanent error. So err will be nil, but the decmsg will be state=error.
		decmsg, err := boxer.UnboxMessage(ctx, *boxed, conv)
		if err != nil {
			t.Fatal(err)
		}
		if decmsg.IsValid() {
			t.Fatalf("message should not be unboxable")
		}
	})
}

func TestChatMessageUnboxNoCryptKey(t *testing.T) {
	doWithMBVersions(func(mbVersion chat1.MessageBoxedVersion) {
		tc, boxer := setupChatTest(t, "unbox")
		defer tc.Cleanup()

		world := NewChatMockWorld(t, "unbox", 4)
		u := world.GetUsers()[0]
		uid := u.User.GetUID().ToBytes()
		tc = world.Tcs[u.Username]
		tlf := kbtest.NewTlfMock(world)
		ctx := newTestContextWithTlfMock(tc, tlf)

		header := chat1.MessageClientHeader{
			Sender:    uid,
			TlfPublic: false,
			TlfName:   u.Username + "M",
		}
		text := "hi"
		msg := textMsgWithHeader(t, text, header)

		signKP := getSigningKeyPairForTest(t, tc, u)

		boxer.boxWithVersion = mbVersion
		_, err := boxer.BoxMessage(ctx, msg, chat1.ConversationMembersType_KBFS, signKP)
		require.Error(t, err)
	})
}

func TestChatMessageInvalidHeaderSig(t *testing.T) {
	doWithMBVersions(func(mbVersion chat1.MessageBoxedVersion) {
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

		// flip a bit in the sig
		called := false
		boxer.testingSignatureMangle = func(sig []byte) []byte {
			called = true
			sig[4] ^= 0x10
			return sig
		}

		boxed, err := boxer.box(msg, key, signKP, mbVersion)
		if err != nil {
			t.Fatal(err)
		}

		require.True(t, called, "mangle must be called")

		// need to give it a server header...
		boxed.ServerHeader = &chat1.MessageServerHeader{
			Ctime: gregor1.ToTime(time.Now()),
		}

		_, ierr := boxer.unbox(context.TODO(), *boxed, key)
		require.NotNil(t, ierr, "must have unbox error")
		switch mbVersion {
		case chat1.MessageBoxedVersion_V1:
			if _, ok := ierr.Inner().(libkb.BadSigError); !ok {
				t.Fatalf("unexpected error for invalid header signature: [%T] %s", ierr.Inner(), ierr)
			}
		case chat1.MessageBoxedVersion_V2:
			if _, ok := ierr.Inner().(signencrypt.Error); !ok {
				t.Fatalf("unexpected error for invalid header signature: [%T] %s", ierr.Inner(), ierr)
			}
		default:
			t.Fatalf("unexpected version: %v", mbVersion)
		}
	})
}

func TestChatMessageInvalidSenderKey(t *testing.T) {
	doWithMBVersions(func(mbVersion chat1.MessageBoxedVersion) {
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

		boxed, err := boxer.box(msg, key, signKP, mbVersion)
		if err != nil {
			t.Fatal(err)
		}

		boxed.ServerHeader = &chat1.MessageServerHeader{
			Ctime: gregor1.ToTime(time.Now()),
		}

		_, ierr := boxer.unbox(context.TODO(), *boxed, key)
		if ierr != nil {
			if _, ok := ierr.Inner().(libkb.NoKeyError); !ok {
				t.Fatalf("unexpected error for invalid sender key: %v", ierr)
			}
		}
	})
}

// Sent with a revoked sender key after revocation
func TestChatMessageRevokedKeyThenSent(t *testing.T) {
	doWithMBVersions(func(mbVersion chat1.MessageBoxedVersion) {
		key := cryptKey(t)
		text := "hi"
		tc, boxer := setupChatTest(t, "unbox")
		defer tc.Cleanup()

		// need a real user
		u, err := kbtest.CreateAndSignupFakeUser("unbox", tc.G)
		require.NoError(t, err)
		t.Logf("using username:%+v uid: %+v", u.Username, u.User.GetUID())

		// pick a device
		devices, _ := getActiveDevicesAndKeys(tc, u)
		var thisDevice *libkb.Device
		for _, device := range devices {
			if device.Type != libkb.DeviceTypePaper {
				thisDevice = device
			}
		}
		require.NotNil(t, thisDevice, "thisDevice should be non-nil")

		// Find the key
		f := func() libkb.SecretUI { return u.NewSecretUI() }
		signingKey, err := engine.GetMySecretKey(context.TODO(), tc.G, f, libkb.DeviceSigningKeyType, "some chat or something test")
		require.NoError(t, err, "get device signing key")
		signKP, ok := signingKey.(libkb.NaclSigningKeyPair)
		require.Equal(t, true, ok, "signing key must be nacl")
		t.Logf("found signing kp: %+v", signKP.GetKID())

		// Revoke the key
		t.Logf("revoking device id:%+v", thisDevice.ID)
		err = doRevokeDevice(tc, u, thisDevice.ID, true)
		require.NoError(t, err, "revoke device")

		// Sleep for a second because revocation timestamps are only second-resolution.
		time.Sleep(1 * time.Second)

		// Reset the cache
		// tc.G.CachedUserLoader = libkb.NewCachedUserLoader(tc.G, libkb.CachedUserTimeout)

		// Sign a message using a key of u's that has been revoked
		t.Logf("signing message")
		msg := textMsgWithSender(t, text, gregor1.UID(u.User.GetUID().ToBytes()))
		boxed, err := boxer.box(msg, key, signKP, mbVersion)
		require.NoError(t, err)

		boxed.ServerHeader = &chat1.MessageServerHeader{
			Ctime: gregor1.ToTime(time.Now()),
		}

		// The message should not unbox
		_, ierr := boxer.unbox(context.TODO(), *boxed, key)
		require.NotNil(t, ierr, "unboxing must err because key was revoked before send")
		require.IsType(t, libkb.NoKeyError{}, ierr.Inner(), "unexpected error for revoked sender key: %v", ierr)

		// Test key validity
		found, validAtCtime, revoked, err := boxer.ValidSenderKey(context.TODO(), gregor1.UID(u.User.GetUID().ToBytes()), signKP.GetBinaryKID(), boxed.ServerHeader.Ctime)
		require.NoError(t, err, "ValidSenderKey")
		require.True(t, found, "revoked key should be found (v:%v r:%v)", found, revoked)
		require.False(t, validAtCtime, "revoked key should be invalid (v:%v r:%v)", validAtCtime, revoked)
		require.NotNil(t, revoked, "key should be revoked (v:%v r:%v)", validAtCtime, revoked)
	})
}

// Sent with a revoked sender key before revocation
func TestChatMessageSentThenRevokedSenderKey(t *testing.T) {
	doWithMBVersions(func(mbVersion chat1.MessageBoxedVersion) {
		key := cryptKey(t)
		text := "hi"
		tc, boxer := setupChatTest(t, "unbox")
		defer tc.Cleanup()

		// need a real user
		u, err := kbtest.CreateAndSignupFakeUser("unbox", tc.G)
		require.NoError(t, err)
		t.Logf("using username:%+v uid: %+v", u.Username, u.User.GetUID())

		// pick a device
		devices, _ := getActiveDevicesAndKeys(tc, u)
		var thisDevice *libkb.Device
		for _, device := range devices {
			if device.Type != libkb.DeviceTypePaper {
				thisDevice = device
			}
		}
		require.NotNil(t, thisDevice, "thisDevice should be non-nil")

		// Find the key
		f := func() libkb.SecretUI { return u.NewSecretUI() }
		signingKey, err := engine.GetMySecretKey(context.TODO(), tc.G, f, libkb.DeviceSigningKeyType, "some chat or something test")
		require.NoError(t, err, "get device signing key")
		signKP, ok := signingKey.(libkb.NaclSigningKeyPair)
		require.Equal(t, true, ok, "signing key must be nacl")
		t.Logf("found signing kp: %+v", signKP.GetKID())

		// Sign a message using a key of u's that has not yet been revoked
		t.Logf("signing message")
		msg := textMsgWithSender(t, text, gregor1.UID(u.User.GetUID().ToBytes()))
		boxed, err := boxer.box(msg, key, signKP, mbVersion)
		require.NoError(t, err)

		boxed.ServerHeader = &chat1.MessageServerHeader{
			Ctime: gregor1.ToTime(time.Now()),
		}

		// Sleep for a second because revocation timestamps are only second-resolution.
		time.Sleep(1 * time.Second)

		// Revoke the key
		t.Logf("revoking device id:%+v", thisDevice.ID)
		err = doRevokeDevice(tc, u, thisDevice.ID, true)
		require.NoError(t, err, "revoke device")

		// The message should unbox but with senderDeviceRevokedAt set
		unboxed, ierr := boxer.unbox(context.TODO(), *boxed, key)
		require.Nil(t, ierr, "unboxing err")
		require.NotNil(t, unboxed.SenderDeviceRevokedAt, "message should be noticed as signed by revoked key")

		// Test key validity
		found, validAtCtime, revoked, err := boxer.ValidSenderKey(context.TODO(), gregor1.UID(u.User.GetUID().ToBytes()), signKP.GetBinaryKID(), boxed.ServerHeader.Ctime)
		require.NoError(t, err, "ValidSenderKey")
		require.True(t, found, "revoked key should be found (v:%v r:%v)", found, revoked)
		require.True(t, validAtCtime, "revoked key should be valid at time (v:%v r:%v)", validAtCtime, revoked)
		require.NotNil(t, revoked, "key should be revoked (v:%v r:%v)", validAtCtime, revoked)
	})
}

func TestChatMessagePublic(t *testing.T) {
	doWithMBVersions(func(mbVersion chat1.MessageBoxedVersion) {
		text := "hi"
		tc, boxer := setupChatTest(t, "unbox")
		defer tc.Cleanup()

		world := NewChatMockWorld(t, "unbox", 4)
		u := world.GetUsers()[0]
		uid := u.User.GetUID().ToBytes()
		tc = world.Tcs[u.Username]
		tlf := kbtest.NewTlfMock(world)
		ctx := newTestContextWithTlfMock(tc, tlf)

		header := chat1.MessageClientHeader{
			Sender:    uid,
			TlfPublic: true,
			TlfName:   u.Username,
		}
		msg := textMsgWithHeader(t, text, header)

		signKP := getSigningKeyPairForTest(t, tc, u)

		boxer.boxWithVersion = mbVersion
		boxed, err := boxer.BoxMessage(ctx, msg, chat1.ConversationMembersType_KBFS, signKP)
		if err != nil {
			t.Fatal(err)
		}
		_ = boxed

		// need to give it a server header...
		boxed.ServerHeader = &chat1.MessageServerHeader{
			Ctime: gregor1.ToTime(time.Now()),
		}

		// NOTE: this is hashing a lot of zero values, and it might break when we add more checks
		convID := header.Conv.ToConversationID([2]byte{0, 0})
		conv := chat1.Conversation{
			Metadata: chat1.ConversationMetadata{
				ConversationID: convID,
			},
		}

		decmsg, err := boxer.UnboxMessage(ctx, *boxed, conv)
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
	})
}

// Test that you cannot unbox a message whose client header sender does not match.
// This prevents one kind of misattribution within a tlf.
// Device mismatches are probably tolerated.
func TestChatMessageSenderMismatch(t *testing.T) {
	doWithMBVersions(func(mbVersion chat1.MessageBoxedVersion) {
		key := cryptKey(t)
		text := "hi"
		tc, boxer := setupChatTest(t, "unbox")
		defer tc.Cleanup()

		u2, err := kbtest.CreateAndSignupFakeUser("chat", tc.G)
		require.NoError(t, err)

		u, err := kbtest.CreateAndSignupFakeUser("unbox", tc.G)
		require.NoError(t, err)

		msg := textMsgWithSender(t, text, gregor1.UID(u.User.GetUID().ToBytes()))

		signKP := getSigningKeyPairForTest(t, tc, u)

		boxed, err := boxer.box(msg, key, signKP, mbVersion)
		if err != nil {
			t.Fatal(err)
		}

		// need to give it a server header...
		boxed.ServerHeader = &chat1.MessageServerHeader{
			Ctime: gregor1.ToTime(time.Now()),
		}

		// Set the outer sender to something else
		boxed.ClientHeader.Sender = gregor1.UID(gregor1.UID(u2.User.GetUID().ToBytes()))

		_, err = boxer.unbox(context.TODO(), *boxed, key)
		require.Error(t, err, "should not unbox with sender mismatch")
	})
}

// Test a message that deletes
func TestChatMessageDeletes(t *testing.T) {
	doWithMBVersions(func(mbVersion chat1.MessageBoxedVersion) {
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
		deleteIDs := []chat1.MessageID{5, 6, 7}
		msg.MessageBody = chat1.NewMessageBodyWithDelete(chat1.MessageDelete{MessageIDs: deleteIDs})
		msg.ClientHeader.Supersedes = deleteIDs[0]
		msg.ClientHeader.Deletes = deleteIDs

		signKP := getSigningKeyPairForTest(t, tc, u)

		boxed, err := boxer.box(msg, key, signKP, mbVersion)
		if err != nil {
			t.Fatal(err)
		}

		// need to give it a server header...
		boxed.ServerHeader = &chat1.MessageServerHeader{
			Ctime:        gregor1.ToTime(time.Now()),
			SupersededBy: 4,
		}

		unboxed, err := boxer.unbox(context.TODO(), *boxed, key)
		require.NoError(t, err, "deleted message should still unbox")
		body := unboxed.MessageBody
		typ, err := body.MessageType()
		require.NoError(t, err)
		require.Equal(t, typ, chat1.MessageType_DELETE)
		require.Nil(t, unboxed.SenderDeviceRevokedAt, "message should not be from revoked device")
	})
}

// Test a message with a deleted body
func TestChatMessageDeleted(t *testing.T) {
	doWithMBVersions(func(mbVersion chat1.MessageBoxedVersion) {
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

		boxed, err := boxer.box(msg, key, signKP, mbVersion)
		if err != nil {
			t.Fatal(err)
		}

		// need to give it a server header...
		boxed.ServerHeader = &chat1.MessageServerHeader{
			Ctime:        gregor1.ToTime(time.Now()),
			SupersededBy: 4,
		}

		// Delete the body
		boxed.BodyCiphertext = chat1.EncryptedData{}

		unboxed, err := boxer.unbox(context.TODO(), *boxed, key)
		require.NoError(t, err, "deleted message should still unbox")
		body := unboxed.MessageBody
		typ, err := body.MessageType()
		require.NoError(t, err)
		require.Equal(t, typ, chat1.MessageType_NONE)
		require.Nil(t, unboxed.SenderDeviceRevokedAt, "message should not be from revoked device")
	})
}

// Test a message with a deleted body but missing a supersededby header
func TestChatMessageDeletedNotSuperseded(t *testing.T) {
	doWithMBVersions(func(mbVersion chat1.MessageBoxedVersion) {
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

		boxed, err := boxer.box(msg, key, signKP, mbVersion)
		if err != nil {
			t.Fatal(err)
		}

		// need to give it a server header...
		boxed.ServerHeader = &chat1.MessageServerHeader{
			Ctime: gregor1.ToTime(time.Now()),
		}

		// Delete the body
		boxed.BodyCiphertext.E = []byte{}

		unboxed, err := boxer.unbox(context.TODO(), *boxed, key)
		// The server was not setting supersededBy on EDITs when their TEXT got deleted.
		// So there are existing messages which have no supersededBy but are legitimately deleted.
		// Tracked in CORE-4662
		require.NoError(t, err, "suprisingly, should be able to unbox with deleted but no supersededby")
		require.Equal(t, chat1.MessageBody{}, unboxed.MessageBody)
	})
}

func TestV1Message1(t *testing.T) {
	// Unbox a canned V1 message from before V2 was thought up.

	tc, boxer := setupChatTest(t, "unbox")
	defer tc.Cleanup()

	canned := getCannedMessage(t, "alice25-bob25-1")
	boxed := canned.AsBoxed(t)
	modifyBoxerForTesting(t, boxer, &canned)

	// Check some features before unboxing
	require.Equal(t, chat1.MessageBoxedVersion_VNONE, boxed.Version)
	require.Equal(t, "1fb5a5e7585a43aba1a59520939e2420", boxed.ClientHeader.Conv.TopicID.String())
	require.Equal(t, canned.encryptionKeyGeneration, boxed.KeyGeneration)

	// Unbox
	unboxed, err := boxer.unbox(context.TODO(), canned.AsBoxed(t), canned.EncryptionKey(t))
	require.NoError(t, err)

	// Check some features of the unboxed
	// ClientHeader
	require.Equal(t, "d1fec1a2287b473206e282f4d4f30116", unboxed.ClientHeader.Conv.Tlfid.String())
	require.Equal(t, "1fb5a5e7585a43aba1a59520939e2420", unboxed.ClientHeader.Conv.TopicID.String())
	require.Equal(t, chat1.TopicType_CHAT, unboxed.ClientHeader.Conv.TopicType)
	require.Equal(t, "alice25,bob25", unboxed.ClientHeader.TlfName)
	require.Equal(t, false, unboxed.ClientHeader.TlfPublic)
	require.Equal(t, chat1.MessageType_TLFNAME, unboxed.ClientHeader.MessageType)
	require.Nil(t, unboxed.ClientHeader.Prev)
	require.Equal(t, canned.SenderUID(t), unboxed.ClientHeader.Sender)
	require.Equal(t, canned.SenderDeviceID(t), unboxed.ClientHeader.SenderDevice)
	// CORE-4540: Uncomment this assertion when MerkleRoot is added to MessageClientHeaderVerified
	// require.Nil(t, unboxed.ClientHeader.MerkleRoot)
	require.Nil(t, unboxed.ClientHeader.OutboxID)
	require.Nil(t, unboxed.ClientHeader.OutboxInfo)

	// ServerHeader
	require.Equal(t, chat1.MessageID(1), unboxed.ServerHeader.MessageID)
	require.Equal(t, chat1.MessageID(0), unboxed.ServerHeader.SupersededBy)

	// MessageBody
	mTyp, err2 := unboxed.MessageBody.MessageType()
	require.NoError(t, err2)
	// MessageBody has no TLFNAME variant, so the type comes out as 0.
	require.Equal(t, chat1.MessageType(0), mTyp)

	// Other attributes of unboxed
	require.Equal(t, canned.senderUsername, unboxed.SenderUsername)
	require.Equal(t, canned.senderDeviceName, unboxed.SenderDeviceName)
	require.Equal(t, canned.senderDeviceType, unboxed.SenderDeviceType)
	require.Equal(t, canned.headerHash, unboxed.HeaderHash.String())
	require.NotNil(t, unboxed.HeaderSignature)
	require.Equal(t, canned.VerifyKey(t), unboxed.HeaderSignature.K)
	require.Nil(t, unboxed.VerificationKey) // nil for MB.V1
	require.Nil(t, unboxed.SenderDeviceRevokedAt)
}

func TestV1Message2(t *testing.T) {
	// Unbox a canned V1 message from before V2 was thought up.

	tc, boxer := setupChatTest(t, "unbox")
	defer tc.Cleanup()

	canned := getCannedMessage(t, "alice25-bob25-2")
	boxed := canned.AsBoxed(t)
	modifyBoxerForTesting(t, boxer, &canned)

	// Check some features before unboxing
	require.Equal(t, chat1.MessageBoxedVersion_VNONE, boxed.Version)
	require.Equal(t, "1fb5a5e7585a43aba1a59520939e2420", boxed.ClientHeader.Conv.TopicID.String())
	require.Equal(t, canned.encryptionKeyGeneration, boxed.KeyGeneration)

	// Unbox
	unboxed, err := boxer.unbox(context.TODO(), canned.AsBoxed(t), canned.EncryptionKey(t))
	require.NoError(t, err)

	// Check some features of the unboxed
	// ClientHeader
	require.Equal(t, "d1fec1a2287b473206e282f4d4f30116", unboxed.ClientHeader.Conv.Tlfid.String())
	require.Equal(t, "1fb5a5e7585a43aba1a59520939e2420", unboxed.ClientHeader.Conv.TopicID.String())
	require.Equal(t, chat1.TopicType_CHAT, unboxed.ClientHeader.Conv.TopicType)
	require.Equal(t, "alice25,bob25", unboxed.ClientHeader.TlfName)
	require.Equal(t, false, unboxed.ClientHeader.TlfPublic)
	require.Equal(t, chat1.MessageType_TEXT, unboxed.ClientHeader.MessageType)
	expectedPrevs := []chat1.MessagePreviousPointer{chat1.MessagePreviousPointer{Id: 0x1, Hash: chat1.Hash{0xc9, 0x6e, 0x28, 0x6d, 0x88, 0x2e, 0xfc, 0x44, 0xdb, 0x80, 0xe5, 0x1d, 0x8e, 0x8, 0xf1, 0xde, 0x28, 0xb4, 0x93, 0x4c, 0xc8, 0x49, 0x1f, 0xbe, 0x88, 0x42, 0xf, 0x31, 0x10, 0x65, 0x14, 0xbe}}}
	require.Equal(t, expectedPrevs, unboxed.ClientHeader.Prev)
	require.Equal(t, canned.SenderUID(t), unboxed.ClientHeader.Sender)
	require.Equal(t, canned.SenderDeviceID(t), unboxed.ClientHeader.SenderDevice)
	// CORE-4540: Uncomment this assertion when MerkleRoot is added to MessageClientHeaderVerified
	// require.Nil(t, unboxed.ClientHeader.MerkleRoot)
	require.Nil(t, unboxed.ClientHeader.OutboxID)
	require.Nil(t, unboxed.ClientHeader.OutboxInfo)

	// ServerHeader
	require.Equal(t, chat1.MessageID(2), unboxed.ServerHeader.MessageID)
	require.Equal(t, chat1.MessageID(0), unboxed.ServerHeader.SupersededBy)

	// MessageBody
	require.Equal(t, "test1", unboxed.MessageBody.Text().Body)

	// Other attributes of unboxed
	require.Equal(t, canned.senderUsername, unboxed.SenderUsername)
	require.Equal(t, canned.senderDeviceName, unboxed.SenderDeviceName)
	require.Equal(t, canned.senderDeviceType, unboxed.SenderDeviceType)
	require.Equal(t, canned.headerHash, unboxed.HeaderHash.String())
	require.NotNil(t, unboxed.HeaderSignature)
	require.Equal(t, canned.VerifyKey(t), unboxed.HeaderSignature.K)
	require.Nil(t, unboxed.VerificationKey) // nil for MB.V1
	require.Nil(t, unboxed.SenderDeviceRevokedAt)
}

func TestV1Message3(t *testing.T) {
	// Unbox a canned V1 message from before V2 was thought up.

	tc, boxer := setupChatTest(t, "unbox")
	defer tc.Cleanup()

	canned := getCannedMessage(t, "bob25-alice25-3-deleted")
	boxed := canned.AsBoxed(t)
	modifyBoxerForTesting(t, boxer, &canned)

	// Check some features before unboxing
	require.Equal(t, chat1.MessageBoxedVersion_VNONE, boxed.Version)
	require.Equal(t, "1fb5a5e7585a43aba1a59520939e2420", boxed.ClientHeader.Conv.TopicID.String())
	require.Equal(t, canned.encryptionKeyGeneration, boxed.KeyGeneration)
	require.Equal(t, chat1.MessageID(3), boxed.ServerHeader.MessageID)
	require.Equal(t, chat1.MessageID(0), boxed.ClientHeader.Supersedes)
	require.Nil(t, boxed.ClientHeader.Deletes)

	// Unbox
	unboxed, err := boxer.unbox(context.TODO(), canned.AsBoxed(t), canned.EncryptionKey(t))
	require.NoError(t, err)

	// Check some features of the unboxed
	// ClientHeader
	require.Equal(t, "d1fec1a2287b473206e282f4d4f30116", unboxed.ClientHeader.Conv.Tlfid.String())
	require.Equal(t, "1fb5a5e7585a43aba1a59520939e2420", unboxed.ClientHeader.Conv.TopicID.String())
	require.Equal(t, chat1.TopicType_CHAT, unboxed.ClientHeader.Conv.TopicType)
	require.Equal(t, "alice25,bob25", unboxed.ClientHeader.TlfName)
	require.Equal(t, false, unboxed.ClientHeader.TlfPublic)
	require.Equal(t, chat1.MessageType_TEXT, unboxed.ClientHeader.MessageType)
	expectedPrevs := []chat1.MessagePreviousPointer{chat1.MessagePreviousPointer{Id: 2, Hash: chat1.Hash{0xbe, 0xb2, 0x7c, 0x41, 0xdb, 0xeb, 0x2e, 0x90, 0x04, 0xf2, 0x48, 0xf2, 0x78, 0x24, 0x3a, 0xde, 0x5e, 0x12, 0x0c, 0xb7, 0xc4, 0x1f, 0x40, 0xe8, 0x47, 0xa2, 0xe2, 0x2f, 0xe8, 0x2c, 0xd3, 0xb4}}}
	require.Equal(t, expectedPrevs, unboxed.ClientHeader.Prev)
	require.Equal(t, canned.SenderUID(t), unboxed.ClientHeader.Sender)
	require.Equal(t, canned.SenderDeviceID(t), unboxed.ClientHeader.SenderDevice)
	// CORE-4540: Uncomment this assertion when MerkleRoot is added to MessageClientHeaderVerified
	// require.Nil(t, unboxed.ClientHeader.MerkleRoot)
	require.Nil(t, unboxed.ClientHeader.OutboxID)
	require.Nil(t, unboxed.ClientHeader.OutboxInfo)

	// ServerHeader
	require.Equal(t, chat1.MessageID(3), unboxed.ServerHeader.MessageID)
	require.Equal(t, chat1.MessageID(5), unboxed.ServerHeader.SupersededBy)

	// MessageBody
	require.Equal(t, chat1.MessageBody{}, unboxed.MessageBody)

	// Other attributes of unboxed
	require.Equal(t, canned.senderUsername, unboxed.SenderUsername)
	require.Equal(t, canned.senderDeviceName, unboxed.SenderDeviceName)
	require.Equal(t, canned.senderDeviceType, unboxed.SenderDeviceType)
	require.Equal(t, canned.headerHash, unboxed.HeaderHash.String())
	require.NotNil(t, unboxed.HeaderSignature)
	require.Equal(t, canned.VerifyKey(t), unboxed.HeaderSignature.K)
	require.Nil(t, unboxed.VerificationKey) // nil for MB.V1
	require.Nil(t, unboxed.SenderDeviceRevokedAt)
}

func TestV1Message4(t *testing.T) {
	// Unbox a canned V1 message from before V2 was thought up.

	tc, boxer := setupChatTest(t, "unbox")
	defer tc.Cleanup()

	canned := getCannedMessage(t, "bob25-alice25-4-deleted-edit")
	boxed := canned.AsBoxed(t)
	modifyBoxerForTesting(t, boxer, &canned)

	// Check some features before unboxing
	require.Equal(t, chat1.MessageBoxedVersion_VNONE, boxed.Version)
	require.Equal(t, "1fb5a5e7585a43aba1a59520939e2420", boxed.ClientHeader.Conv.TopicID.String())
	require.Equal(t, canned.encryptionKeyGeneration, boxed.KeyGeneration)
	require.Equal(t, chat1.MessageID(4), boxed.ServerHeader.MessageID)
	require.Equal(t, chat1.MessageID(3), boxed.ClientHeader.Supersedes)
	require.Nil(t, boxed.ClientHeader.Deletes)

	// Unbox
	unboxed, err := boxer.unbox(context.TODO(), canned.AsBoxed(t), canned.EncryptionKey(t))
	require.NoError(t, err)

	// Check some features of the unboxed
	// ClientHeader
	require.Equal(t, "d1fec1a2287b473206e282f4d4f30116", unboxed.ClientHeader.Conv.Tlfid.String())
	require.Equal(t, "1fb5a5e7585a43aba1a59520939e2420", unboxed.ClientHeader.Conv.TopicID.String())
	require.Equal(t, chat1.TopicType_CHAT, unboxed.ClientHeader.Conv.TopicType)
	require.Equal(t, "alice25,bob25", unboxed.ClientHeader.TlfName)
	require.Equal(t, false, unboxed.ClientHeader.TlfPublic)
	require.Equal(t, chat1.MessageType_EDIT, unboxed.ClientHeader.MessageType)

	expectedPrevs := []chat1.MessagePreviousPointer{chat1.MessagePreviousPointer{Id: 3, Hash: chat1.Hash{0x3b, 0x54, 0x7a, 0x7a, 0xdd, 0x32, 0x5c, 0xcc, 0x9f, 0x4d, 0x30, 0x12, 0xc5, 0x6e, 0xb1, 0xab, 0xa0, 0x1c, 0xf7, 0x68, 0x7e, 0x26, 0x13, 0x49, 0x3f, 0xf5, 0xc9, 0xb7, 0x16, 0xaf, 0xd5, 0x07}}}
	require.Equal(t, expectedPrevs, unboxed.ClientHeader.Prev)
	require.Equal(t, canned.SenderUID(t), unboxed.ClientHeader.Sender)
	require.Equal(t, canned.SenderDeviceID(t), unboxed.ClientHeader.SenderDevice)
	// CORE-4540: Uncomment this assertion when MerkleRoot is added to MessageClientHeaderVerified
	// require.Nil(t, unboxed.ClientHeader.MerkleRoot)
	expectedOutboxID := chat1.OutboxID{0x8e, 0xcc, 0x94, 0xb7, 0xff, 0x50, 0x5c, 0x4}
	require.Equal(t, &expectedOutboxID, unboxed.ClientHeader.OutboxID)
	expectedOutboxInfo := &chat1.OutboxInfo{Prev: 0x3, ComposeTime: 1487708373568}
	require.Equal(t, expectedOutboxInfo, unboxed.ClientHeader.OutboxInfo)

	// ServerHeader
	require.Equal(t, chat1.MessageID(4), unboxed.ServerHeader.MessageID)
	// At the time this message was canned, supersededBy was not set deleted edits.
	require.Equal(t, chat1.MessageID(0), unboxed.ServerHeader.SupersededBy)

	// MessageBody
	require.Equal(t, chat1.MessageBody{}, unboxed.MessageBody)

	// Other attributes of unboxed
	require.Equal(t, canned.senderUsername, unboxed.SenderUsername)
	require.Equal(t, canned.senderDeviceName, unboxed.SenderDeviceName)
	require.Equal(t, canned.senderDeviceType, unboxed.SenderDeviceType)
	require.Equal(t, canned.headerHash, unboxed.HeaderHash.String())
	require.NotNil(t, unboxed.HeaderSignature)
	require.Equal(t, canned.VerifyKey(t), unboxed.HeaderSignature.K)
	require.Nil(t, unboxed.VerificationKey) // nil for MB.V1
	require.Nil(t, unboxed.SenderDeviceRevokedAt)
}

func TestV1Message5(t *testing.T) {
	// Unbox a canned V1 message from before V2 was thought up.

	tc, boxer := setupChatTest(t, "unbox")
	defer tc.Cleanup()

	canned := getCannedMessage(t, "bob25-alice25-5-delete")
	boxed := canned.AsBoxed(t)
	modifyBoxerForTesting(t, boxer, &canned)

	// Check some features before unboxing
	require.Equal(t, chat1.MessageBoxedVersion_VNONE, boxed.Version)
	require.Equal(t, "1fb5a5e7585a43aba1a59520939e2420", boxed.ClientHeader.Conv.TopicID.String())
	require.Equal(t, canned.encryptionKeyGeneration, boxed.KeyGeneration)
	require.Equal(t, chat1.MessageID(5), boxed.ServerHeader.MessageID)
	require.Equal(t, chat1.MessageID(3), boxed.ClientHeader.Supersedes)
	expectedDeletesIDs := []chat1.MessageID{3, 4}
	require.Equal(t, expectedDeletesIDs, boxed.ClientHeader.Deletes)

	// Unbox
	unboxed, err := boxer.unbox(context.TODO(), canned.AsBoxed(t), canned.EncryptionKey(t))
	require.NoError(t, err)

	// Check some features of the unboxed
	// ClientHeader
	require.Equal(t, "d1fec1a2287b473206e282f4d4f30116", unboxed.ClientHeader.Conv.Tlfid.String())
	require.Equal(t, "1fb5a5e7585a43aba1a59520939e2420", unboxed.ClientHeader.Conv.TopicID.String())
	require.Equal(t, chat1.TopicType_CHAT, unboxed.ClientHeader.Conv.TopicType)
	require.Equal(t, "alice25,bob25", unboxed.ClientHeader.TlfName)
	require.Equal(t, false, unboxed.ClientHeader.TlfPublic)
	require.Equal(t, chat1.MessageType_DELETE, unboxed.ClientHeader.MessageType)

	expectedPrevs := []chat1.MessagePreviousPointer{chat1.MessagePreviousPointer{Id: 4, Hash: chat1.Hash{0xea, 0x68, 0x5e, 0x0f, 0x26, 0xb5, 0xb4, 0xfc, 0x1d, 0xe4, 0x15, 0x11, 0x34, 0x40, 0xcc, 0x3d, 0x54, 0x65, 0xa1, 0x52, 0x42, 0xd6, 0x83, 0xa7, 0xf4, 0x88, 0x96, 0xec, 0xd2, 0xc6, 0xd6, 0x26}}}
	require.Equal(t, expectedPrevs, unboxed.ClientHeader.Prev)
	require.Equal(t, canned.SenderUID(t), unboxed.ClientHeader.Sender)
	require.Equal(t, canned.SenderDeviceID(t), unboxed.ClientHeader.SenderDevice)
	// CORE-4540: Uncomment this assertion when MerkleRoot is added to MessageClientHeaderVerified
	// require.Nil(t, unboxed.ClientHeader.MerkleRoot)
	expectedOutboxID := chat1.OutboxID{0xdc, 0x74, 0x6, 0x5d, 0xf9, 0x5f, 0x1c, 0x48}
	require.Equal(t, &expectedOutboxID, unboxed.ClientHeader.OutboxID)
	expectedOutboxInfo := &chat1.OutboxInfo{Prev: 0x3, ComposeTime: 1487708384552}
	require.Equal(t, expectedOutboxInfo, unboxed.ClientHeader.OutboxInfo)

	// ServerHeader
	require.Equal(t, chat1.MessageID(5), unboxed.ServerHeader.MessageID)
	require.Equal(t, chat1.MessageID(0), unboxed.ServerHeader.SupersededBy)

	// MessageBody
	require.Equal(t, chat1.MessageDelete{MessageIDs: expectedDeletesIDs}, unboxed.MessageBody.Delete())

	// Other attributes of unboxed
	require.Equal(t, canned.senderUsername, unboxed.SenderUsername)
	require.Equal(t, canned.senderDeviceName, unboxed.SenderDeviceName)
	require.Equal(t, canned.senderDeviceType, unboxed.SenderDeviceType)
	require.Equal(t, canned.headerHash, unboxed.HeaderHash.String())
	require.NotNil(t, unboxed.HeaderSignature)
	require.Equal(t, canned.VerifyKey(t), unboxed.HeaderSignature.K)
	require.Nil(t, unboxed.VerificationKey) // nil for MB.V1
	require.Nil(t, unboxed.SenderDeviceRevokedAt)
}

func modifyBoxerForTesting(t *testing.T, boxer *Boxer, canned *cannedMessage) {
	boxer.testingGetSenderInfoLocal = func(ctx context.Context, uid gregor1.UID, did gregor1.DeviceID) (senderUsername string, senderDeviceName string, senderDeviceType string) {
		require.Equal(t, canned.SenderUID(t), uid)
		require.Equal(t, canned.SenderDeviceID(t), did)
		return canned.senderUsername, canned.senderDeviceName, canned.senderDeviceType
	}
	boxer.testingValidSenderKey = func(ctx context.Context, uid gregor1.UID, verifyKey []byte, ctime gregor1.Time) (found, validAtCTime bool, revoked *gregor1.Time, unboxingErr UnboxingError) {
		require.Equal(t, canned.SenderUID(t), uid)
		require.Equal(t, canned.VerifyKey(t), verifyKey)
		// ignore ctime, always report the key as still valid
		return true, true, nil, nil
	}
}

func requireValidMessage(t *testing.T, unboxed chat1.MessageUnboxed, description string) {
	state, err := unboxed.State()
	require.NoError(t, err, "failed to get the unboxed message state")
	require.Equal(t, chat1.MessageUnboxedState_VALID, state, description)
}

func requireErrorMessage(t *testing.T, unboxed chat1.MessageUnboxed, description string) {
	state, err := unboxed.State()
	require.NoError(t, err, "failed to get the unboxed message state")
	require.Equal(t, chat1.MessageUnboxedState_ERROR, state, description)
}

func TestChatMessageBodyHashReplay(t *testing.T) {
	doWithMBVersions(func(mbVersion chat1.MessageBoxedVersion) {
		text := "hi"
		tc, boxer := setupChatTest(t, "unbox")
		defer tc.Cleanup()

		// need a real user
		u, err := kbtest.CreateAndSignupFakeUser("unbox", tc.G)
		if err != nil {
			t.Fatal(err)
		}

		signKP := getSigningKeyPairForTest(t, tc, u)

		// Generate an encryption key and create a fake finder to fetch it.
		key := cryptKey(t)
		finder := NewKeyFinderMock([]keybase1.CryptKey{*key})
		boxerContext := context.WithValue(context.Background(), kfKey, finder)

		// This message has an all zeros ConversationIDTriple, but that's fine. We
		// can still extract the ConvID from it.
		msg := textMsgWithSender(t, text, gregor1.UID(u.User.GetUID().ToBytes()))
		convID := msg.ClientHeader.Conv.ToConversationID([2]byte{0, 0})
		conv := chat1.Conversation{
			Metadata: chat1.ConversationMetadata{
				ConversationID: convID,
			},
		}
		boxed, err := boxer.box(msg, key, signKP, mbVersion)
		if err != nil {
			t.Fatal(err)
		}

		// Need to give it a server header...
		boxed.ServerHeader = &chat1.MessageServerHeader{
			Ctime:     gregor1.ToTime(time.Now()),
			MessageID: 1,
		}

		// Unbox the message once.
		unboxed, err := boxer.UnboxMessage(boxerContext, *boxed, conv)
		require.NoError(t, err)
		requireValidMessage(t, unboxed, "we expected msg4 to succeed")

		// Unbox it again. This should be fine.
		unboxed, err = boxer.UnboxMessage(boxerContext, *boxed, conv)
		require.NoError(t, err)
		requireValidMessage(t, unboxed, "we expected msg4 to succeed the second time too")

		// Now try to unbox it again with a different MessageID. This must fail.
		boxed.ServerHeader.MessageID = 2
		unboxed, err = boxer.UnboxMessage(boxerContext, *boxed, conv)
		require.NoError(t, err)
		requireErrorMessage(t, unboxed, "replay must be detected")
	})
}

func TestChatMessagePrevPointerInconsistency(t *testing.T) {
	doWithMBVersions(func(mbVersion chat1.MessageBoxedVersion) {
		tc, boxer := setupChatTest(t, "unbox")
		defer tc.Cleanup()

		// need a real user
		u, err := kbtest.CreateAndSignupFakeUser("unbox", tc.G)
		require.NoError(t, err)

		signKP := getSigningKeyPairForTest(t, tc, u)

		// Generate an encryption key and create a fake finder to fetch it.
		key := cryptKey(t)
		finder := NewKeyFinderMock([]keybase1.CryptKey{*key})
		boxerContext := context.WithValue(context.Background(), kfKey, finder)

		// Everything below will use the zero convID.
		convID := chat1.ConversationIDTriple{}.ToConversationID([2]byte{0, 0})
		conv := chat1.Conversation{
			Metadata: chat1.ConversationMetadata{
				ConversationID: convID,
			},
		}

		makeMsg := func(id chat1.MessageID, prevs []chat1.MessagePreviousPointer) *chat1.MessageBoxed {
			msg := textMsgWithSender(t, "foo text", gregor1.UID(u.User.GetUID().ToBytes()))
			msg.ClientHeader.Prev = prevs
			boxed, err := boxer.box(msg, key, signKP, mbVersion)
			require.NoError(t, err)
			boxed.ServerHeader = &chat1.MessageServerHeader{
				Ctime:     gregor1.ToTime(time.Now()),
				MessageID: id,
			}
			return boxed
		}

		// Generate a couple of initial messages, with no prev pointers of their own.
		boxed1 := makeMsg(1, nil)
		boxed2 := makeMsg(2, nil)

		// Now unbox the first message. That caches its header hash. Leave the
		// second one out of the cache for now though. (We'll use it to cause an
		// error later.)
		unboxed1, err := boxer.UnboxMessage(boxerContext, *boxed1, conv)
		require.NoError(t, err)

		// Create two more messages, which both have bad prev pointers. Msg3 has a
		// bad prev for msg1, and must fail to unbox, because we've already unboxed
		// msg1. Msg4 has a bad prev for msg2 (which we haven't unboxed yet)
		// and a good prev for msg1. Msg4 will therefore succeed at unboxing now,
		// and we will check that msg2 fails later.
		boxed3 := makeMsg(3, []chat1.MessagePreviousPointer{
			chat1.MessagePreviousPointer{
				Id: 1,
				// Bad pointer for msg1. This will cause an immediate unboxing failure.
				Hash: []byte("BAD PREV POINTER HERE"),
			},
		})
		boxed4 := makeMsg(4, []chat1.MessagePreviousPointer{
			chat1.MessagePreviousPointer{
				Id: 1,
				// Good pointer for msg1.
				Hash: unboxed1.Valid().HeaderHash,
			},
			chat1.MessagePreviousPointer{
				Id: 2,
				// Bad pointer for msg2. Because we've never unboxed message 2
				// before, though, we'll cache this bad prev pointer, and it's msg2
				// that will fail to unbox.
				Hash: []byte("ANOTHER BAD PREV POINTER OMG"),
			},
		})

		unboxed, err := boxer.UnboxMessage(boxerContext, *boxed3, conv)
		require.NoError(t, err)
		requireErrorMessage(t, unboxed, "msg3 has a known bad prev pointer and must fail to unbox")

		unboxed, err = boxer.UnboxMessage(boxerContext, *boxed4, conv)
		require.NoError(t, err)
		requireValidMessage(t, unboxed, "we expected msg4 to succeed")

		// Now try to unbox msg2. Because of msg4's bad pointer, this should fail.
		unboxed, err = boxer.UnboxMessage(boxerContext, *boxed2, conv)
		require.NoError(t, err)
		requireErrorMessage(t, unboxed, "msg2 should fail to unbox, because of msg4's bad pointer")
	})
}

func TestChatMessageBadConvID(t *testing.T) {
	doWithMBVersions(func(mbVersion chat1.MessageBoxedVersion) {
		text := "hi"
		tc, boxer := setupChatTest(t, "unbox")
		defer tc.Cleanup()

		// need a real user
		u, err := kbtest.CreateAndSignupFakeUser("unbox", tc.G)
		require.NoError(t, err)

		signKP := getSigningKeyPairForTest(t, tc, u)

		// Generate an encryption key and create a fake finder to fetch it.
		key := cryptKey(t)
		finder := NewKeyFinderMock([]keybase1.CryptKey{*key})
		boxerContext := context.WithValue(context.Background(), kfKey, finder)

		// This message has an all zeros ConversationIDTriple, but that's fine. We
		// can still extract the ConvID from it.
		msg := textMsgWithSender(t, text, gregor1.UID(u.User.GetUID().ToBytes()))
		boxed, err := boxer.box(msg, key, signKP, mbVersion)
		require.NoError(t, err)
		boxed.ServerHeader = &chat1.MessageServerHeader{
			Ctime:     gregor1.ToTime(time.Now()),
			MessageID: 1,
		}

		// Confirm that this message fails to unbox if we use a convID that doesn't
		// derive from the same triple.
		badTriple := chat1.ConversationIDTriple{
			Tlfid: []byte("random non-matching TLF ID"),
		}
		badConvID := badTriple.ToConversationID([2]byte{0, 0})
		badConv := chat1.Conversation{
			Metadata: chat1.ConversationMetadata{
				ConversationID: badConvID,
			},
		}

		unboxed, err := boxer.UnboxMessage(boxerContext, *boxed, badConv)
		require.NoError(t, err)
		requireErrorMessage(t, unboxed, "expected a bad convID to fail the unboxing")
	})
}

type KeyFinderMock struct {
	cryptKeys []keybase1.CryptKey
}

var _ KeyFinder = (*KeyFinderMock)(nil)

func NewKeyFinderMock(cryptKeys []keybase1.CryptKey) KeyFinder {
	return &KeyFinderMock{cryptKeys}
}

func (k *KeyFinderMock) Find(ctx context.Context, tlfName string,
	membersType chat1.ConversationMembersType, tlfPublic bool) (res types.NameInfo, err error) {
	for _, key := range k.cryptKeys {
		res.CryptKeys = append(res.CryptKeys, key)
	}
	return res, nil
}

func (k *KeyFinderMock) SetNameInfoSourceOverride(ni types.NameInfoSource) {}

func remarshalBoxed(t *testing.T, v chat1.MessageBoxed) *chat1.MessageBoxed {
	// encode
	mh := codec.MsgpackHandle{WriteExt: true}
	var data []byte
	enc := codec.NewEncoderBytes(&data, &mh)
	err := enc.Encode(v)
	require.NoError(t, err)

	// decode
	var v2 chat1.MessageBoxed
	mh = codec.MsgpackHandle{WriteExt: true}
	dec := codec.NewDecoderBytes(data, &mh)
	err = dec.Decode(&v2)
	require.NoError(t, err)
	return &v2
}

func TestRemarshalBoxed(t *testing.T) {
	outboxID1 := chat1.OutboxID{0xdc, 0x74, 0x6, 0x5d, 0xf9, 0x5f, 0x1c, 0x48}
	boxed1 := chat1.MessageBoxed{
		ClientHeader: chat1.MessageClientHeader{
			OutboxID: &outboxID1,
		},
	}

	var boxed2 chat1.MessageBoxed
	boxed2 = *remarshalBoxed(t, boxed1)

	require.NotEqual(t, chat1.MessageBoxed{}, boxed2, "second shouldn't be zeroed")
	require.Equal(t, boxed1.ClientHeader.OutboxID == nil, boxed2.ClientHeader.OutboxID == nil, "obids should have same nility")

	if boxed1.ClientHeader.OutboxID == boxed2.ClientHeader.OutboxID {
		t.Fatalf("obids should not have same address")
	}

	require.NotNil(t, boxed1.ClientHeader.OutboxID, "obid1 should not be nil")
	require.NotNil(t, boxed2.ClientHeader.OutboxID, "obid2 should not be nil")

	require.Equal(t, boxed1.ClientHeader.OutboxID, boxed2.ClientHeader.OutboxID, "obids should have same value")
}
