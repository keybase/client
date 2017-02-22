package chat

// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

import (
	"crypto/sha256"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"

	"github.com/keybase/client/go/engine"
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

func getActiveDevicesAndKeys(tc libkb.TestContext, u *kbtest.FakeUser) ([]*libkb.Device, []libkb.GenericKey) {
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

func doRevokeDevice(tc libkb.TestContext, u *kbtest.FakeUser, id keybase1.DeviceID, force bool) error {
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
	// TODO uncomment after implementing V2
	// f(chat1.MessageBoxedVersion_V2)
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

		signKP := getSigningKeyPairForTest(t, tc, u)

		boxed, err := boxer.box(msg, key, signKP, mbVersion)
		if err != nil {
			t.Fatal(err)
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
	})
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

		u, err := kbtest.CreateAndSignupFakeUser("unbox", tc.G)
		if err != nil {
			t.Fatal(err)
		}

		world := kbtest.NewChatMockWorld(t, "unbox", 4)
		tlf := kbtest.NewTlfMock(world)
		boxer.tlf = func() keybase1.TlfInterface { return tlf }

		header := chat1.MessageClientHeader{
			Sender:    gregor1.UID(u.User.GetUID().ToBytes()),
			TlfPublic: true,
			TlfName:   "hi",
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

		ctx := context.Background()
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
		decmsg, err := boxer.UnboxMessage(ctx, *boxed, nil /* finalizeInfo */)
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

		u, err := kbtest.CreateAndSignupFakeUser("unbox", tc.G)
		if err != nil {
			t.Fatal(err)
		}

		world := kbtest.NewChatMockWorld(t, "unbox", 4)
		tlf := kbtest.NewTlfMock(world)
		boxer.tlf = func() keybase1.TlfInterface { return tlf }

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
		bctx := context.WithValue(ctx, kfKey, NewKeyFinderMock())
		decmsg, ierr := boxer.UnboxMessage(bctx, *boxed, nil /* finalizeInfo */)
		if !strings.Contains(ierr.Error(), "no key found") {
			t.Fatalf("error should contain 'no key found': %v", ierr)
		}
		if decmsg.IsValid() {
			t.Fatalf("message should not be unboxable")
		}
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

		boxed, err := boxer.box(msg, key, signKP, mbVersion)
		if err != nil {
			t.Fatal(err)
		}

		// need to give it a server header...
		boxed.ServerHeader = &chat1.MessageServerHeader{
			Ctime: gregor1.ToTime(time.Now()),
		}

		// put original signing fn back
		boxer.sign = origSign

		_, ierr := boxer.unbox(context.TODO(), *boxed, key)
		if _, ok := ierr.Inner().(libkb.BadSigError); !ok {
			t.Fatalf("unexpected error for invalid header signature: %s", ierr)
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
		signingKey, err := engine.GetMySecretKey(tc.G, f, libkb.DeviceSigningKeyType, "some chat or something test")
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
		signingKey, err := engine.GetMySecretKey(tc.G, f, libkb.DeviceSigningKeyType, "some chat or something test")
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

		// need a real user
		u, err := kbtest.CreateAndSignupFakeUser("unbox", tc.G)
		if err != nil {
			t.Fatal(err)
		}

		world := kbtest.NewChatMockWorld(t, "unbox", 4)
		tlf := kbtest.NewTlfMock(world)
		boxer.tlf = func() keybase1.TlfInterface { return tlf }

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

		decmsg, err := boxer.UnboxMessage(ctx, *boxed, nil /* finalizeInfo */)
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
		boxed.BodyCiphertext.E = []byte{}

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

		_, err = boxer.unbox(context.TODO(), *boxed, key)
		require.Error(t, err, "should not unbox with deleted but no supersededby")
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
	require.Equal(t, chat1.MessageID(0), unboxed.ClientHeader.Supersedes)
	require.Nil(t, unboxed.ClientHeader.Deletes)
	require.Nil(t, unboxed.ClientHeader.Prev)
	require.Equal(t, canned.SenderUID(t), unboxed.ClientHeader.Sender)
	require.Equal(t, canned.SenderDeviceID(t), unboxed.ClientHeader.SenderDevice)
	require.Nil(t, unboxed.ClientHeader.MerkleRoot)
	require.Nil(t, unboxed.ClientHeader.OutboxID)
	require.Nil(t, unboxed.ClientHeader.OutboxInfo)

	// ServerHeader
	require.Equal(t, chat1.MessageID(0), unboxed.ServerHeader.SupersededBy)
	require.Equal(t, chat1.MessageID(1), unboxed.ServerHeader.MessageID)

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
	require.Equal(t, chat1.MessageID(0), unboxed.ClientHeader.Supersedes)
	require.Nil(t, unboxed.ClientHeader.Deletes)
	expectedPrevs := []chat1.MessagePreviousPointer{chat1.MessagePreviousPointer{Id: 0x1, Hash: chat1.Hash{0xc9, 0x6e, 0x28, 0x6d, 0x88, 0x2e, 0xfc, 0x44, 0xdb, 0x80, 0xe5, 0x1d, 0x8e, 0x8, 0xf1, 0xde, 0x28, 0xb4, 0x93, 0x4c, 0xc8, 0x49, 0x1f, 0xbe, 0x88, 0x42, 0xf, 0x31, 0x10, 0x65, 0x14, 0xbe}}}
	require.Equal(t, expectedPrevs, unboxed.ClientHeader.Prev)
	require.Equal(t, canned.SenderUID(t), unboxed.ClientHeader.Sender)
	require.Equal(t, canned.SenderDeviceID(t), unboxed.ClientHeader.SenderDevice)
	require.Nil(t, unboxed.ClientHeader.MerkleRoot)
	require.Nil(t, unboxed.ClientHeader.OutboxID)
	require.Nil(t, unboxed.ClientHeader.OutboxInfo)

	// ServerHeader
	require.Equal(t, chat1.MessageID(0), unboxed.ServerHeader.SupersededBy)
	require.Equal(t, chat1.MessageID(2), unboxed.ServerHeader.MessageID)

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

type KeyFinderMock struct{}

func NewKeyFinderMock() KeyFinder {
	return &KeyFinderMock{}
}

func (k *KeyFinderMock) Find(ctx context.Context, tlf keybase1.TlfInterface, tlfName string, tlfPublic bool) (keybase1.GetTLFCryptKeysRes, error) {
	return keybase1.GetTLFCryptKeysRes{}, nil
}
