package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/kex"
	keybase1 "github.com/keybase/client/protocol/go"
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
		DevKeyID: keybase1.KIDFromString("123456"),
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

	fu := CreateAndSignupFakeUser(tc, "login")

	sec, err := kex.NewSecret(fu.Username)
	if err != nil {
		t.Fatal(err)
	}

	var tok, csrf string
	err = tc.G.LoginState().LocalSession(func(s *libkb.Session) {
		tok, csrf = s.APIArgs()
	}, "TestBasicMessage")
	if err != nil {
		t.Fatal(err)
	}

	s := kex.NewSender(kex.DirectionYtoX, sec.Secret(), tok, csrf, tc.G)
	r := kex.NewReceiver(kex.DirectionYtoX, sec, tok, csrf)

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
		t.Errorf("msg: %s, expected %s", msg.Name(), kex.StartKexMsg)
	}
}

func TestBadMACMessage(t *testing.T) {
	tc := SetupEngineTest(t, "kex")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "login")

	sec, err := kex.NewSecret(fu.Username)
	if err != nil {
		t.Fatal(err)
	}

	var tok, csrf string
	err = tc.G.LoginState().LocalSession(func(s *libkb.Session) {
		tok, csrf = s.APIArgs()
	}, "TestBadMACMessage")
	if err != nil {
		t.Fatal(err)
	}

	s := kex.NewSender(kex.DirectionYtoX, sec.Secret(), tok, csrf, tc.G)
	r := kex.NewReceiver(kex.DirectionYtoX, sec, tok, csrf)

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
