package chat

import (
	"context"
	"testing"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// staleThenFreshUPAKFinder answers CheckKIDForUID with "not found" until
// learnKey is called, like a reader whose cached UPAK predates the sender's
// newly provisioned device.
type staleThenFreshUPAKFinder struct {
	knowsKey bool
	checks   int
}

var _ types.UPAKFinder = (*staleThenFreshUPAKFinder)(nil)

func (f *staleThenFreshUPAKFinder) learnKey() { f.knowsKey = true }

func (f *staleThenFreshUPAKFinder) LookupUsernameAndDevice(context.Context, keybase1.UID, keybase1.DeviceID) (libkb.NormalizedUsername, string, keybase1.DeviceTypeV2, error) {
	return "", "", keybase1.DeviceTypeV2_NONE, nil
}

func (f *staleThenFreshUPAKFinder) CheckKIDForUID(context.Context, keybase1.UID, keybase1.KID) (bool, *keybase1.KeybaseTime, bool, error) {
	f.checks++
	return f.knowsKey, nil, false, nil
}

type staleThenFreshCtxFactory struct {
	upak *staleThenFreshUPAKFinder
}

func (c staleThenFreshCtxFactory) NewKeyFinder() types.KeyFinder   { return NewKeyFinderMock(nil) }
func (c staleThenFreshCtxFactory) NewUPAKFinder() types.UPAKFinder { return c.upak }

// A message signed by a device key the reader's UPAK does not know yet (the
// sender just provisioned that device) must not come back as a permanent
// error. Permanent unbox errors become error messages that chat local storage
// keeps and serves on every later read, so the message would never decrypt,
// even after the reader's UPAK learns the key. The miss must be transient, and
// the same message must unbox once the key is known.
func TestChatMessageUnboxSenderKeyMissIsNotPermanent(t *testing.T) {
	tc, boxer := setupChatTest(t, "unbox")
	defer tc.Cleanup()

	canned := getCannedMessage(t, "alice25-bob25-1")
	boxer.testingGetSenderInfoLocal = func(context.Context, gregor1.UID, gregor1.DeviceID) (string, string, keybase1.DeviceTypeV2) {
		return canned.senderUsername, canned.senderDeviceName, canned.senderDeviceType
	}
	upak := &staleThenFreshUPAKFinder{}
	tc.ChatG.CtxFactory = staleThenFreshCtxFactory{upak: upak}

	_, uberr := boxer.unbox(context.TODO(), canned.AsBoxed(t), convInfo, canned.EncryptionKey(t), nil)
	require.Equal(t, 1, upak.checks, "unbox should check the sender key against the UPAK")
	require.Error(t, uberr, "the sender key is unknown, so this unbox cannot succeed yet")
	require.False(t, uberr.IsPermanent(),
		"a sender-key miss must be transient so the message is retried, not stored as an error: %v", uberr)

	upak.learnKey()
	unboxed, uberr := boxer.unbox(context.TODO(), canned.AsBoxed(t), convInfo, canned.EncryptionKey(t), nil)
	require.NoError(t, uberr)
	requireValidMessage(t, chat1.NewMessageUnboxedWithValid(*unboxed), "unboxes once the key is known")
}
