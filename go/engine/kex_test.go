package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/kex"
)

func testKexMeta(t *testing.T, username string, sec *kex.Secret) *kex.Meta {
	sendID, err := libkb.NewDeviceID()
	if err != nil {
		t.Fatal(err)
	}
	recID, err := libkb.NewDeviceID()
	if err != nil {
		t.Fatal(err)
	}
	return &kex.Meta{UID: libkb.UsernameToUID(username), Seqno: 0, StrongID: sec.StrongID(), WeakID: sec.WeakID(), Sender: sendID, Receiver: recID}
}

func testBody(t *testing.T) *kex.Body {
	did, err := libkb.NewDeviceID()
	if err != nil {
		t.Fatal(err)
	}
	a := kex.MsgArgs{
		DeviceID: did,
		DevKeyID: libkb.KID([]byte{1, 2, 3, 4, 5}),
	}

	return &kex.Body{
		Name: kex.StartKexMsg,
		Args: a,
	}
}

// TestBasicMessage verifies that a message can be sent and
// received.
func TestBasicMessage(t *testing.T) {
	tc := SetupEngineTest(t, "kex")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(t, "login")

	sec, err := kex.NewSecret(fu.Username)
	if err != nil {
		t.Fatal(err)
	}

	s := kex.NewSender(kex.DirectionYtoX, sec.Secret())
	r := kex.NewReceiver(kex.DirectionYtoX, sec)

	ctx := testKexMeta(t, fu.Username, sec)
	if err := s.StartKexSession(ctx, ctx.StrongID); err != nil {
		t.Fatal(err)
	}
	rctx := testKexMeta(t, fu.Username, sec)
	rctx.Swap()
	n, err := r.Receive(rctx)
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Errorf("receive count: %d, expected 1", n)
	}
	msg := <-r.Msgs
	if msg.Name() != kex.StartKexMsg {
		t.Errorf("msg: %s, expected %s", msg.Name, kex.StartKexMsg)
	}
}

func TestBadMACMessage(t *testing.T) {
	tc := SetupEngineTest(t, "kex")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(t, "login")

	sec, err := kex.NewSecret(fu.Username)
	if err != nil {
		t.Fatal(err)
	}

	s := kex.NewSender(kex.DirectionYtoX, sec.Secret())
	r := kex.NewReceiver(kex.DirectionYtoX, sec)

	ctx := testKexMeta(t, fu.Username, sec)
	if err := s.CorruptStartKexSession(ctx, ctx.StrongID); err != nil {
		t.Fatal(err)
	}
	rctx := testKexMeta(t, fu.Username, sec)
	rctx.Swap()
	n, err := r.Receive(rctx)
	if err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Errorf("receive count: %d, expected 0", n)
	}
}
