package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/kex"
)

func testKexMeta(t *testing.T, username string) *kex.Meta {
	sendID, err := libkb.NewDeviceID()
	if err != nil {
		t.Fatal(err)
	}
	recID, err := libkb.NewDeviceID()
	if err != nil {
		t.Fatal(err)
	}
	sid := [32]byte{1, 1, 1, 1, 1}
	return &kex.Meta{UID: libkb.UsernameToUID(username), Seqno: 2, StrongID: sid, Sender: sendID, Receiver: recID}
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
		Name: startkexMsg,
		Args: a,
	}
}

// TestBasicMessage verifies that a message can be sent and
// received.
func TestBasicMessage(t *testing.T) {
	tc := libkb.SetupTest(t, "kex")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(t, "login")

	h := newKth()
	s := kex.NewSender(kex.DirectionYtoX)
	r := kex.NewReceiver(h, kex.DirectionYtoX)

	ctx := testKexMeta(t, fu.Username)
	if err := s.StartKexSession(ctx, ctx.StrongID); err != nil {
		t.Fatal(err)
	}
	rctx := &kex.Meta{}
	if err := r.Receive(rctx); err != nil {
		t.Fatal(err)
	}
	if h.callCount(startkexMsg) != 1 {
		t.Errorf("startkex call count: %d, expected 1", h.callCount(startkexMsg))
	}
}

func TestBadMACMessage(t *testing.T) {
	tc := libkb.SetupTest(t, "kex")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(t, "login")

	h := newKth()
	s := kex.NewSender(kex.DirectionYtoX)
	r := kex.NewReceiver(h, kex.DirectionYtoX)

	ctx := testKexMeta(t, fu.Username)
	if err := s.CorruptStartKexSession(ctx, ctx.StrongID); err != nil {
		t.Fatal(err)
	}
	rctx := &kex.Meta{}
	if err := r.Receive(rctx); err != nil {
		t.Fatal(err)
	}
	if h.callCount(startkexMsg) != 0 {
		t.Errorf("startkex call count: %d, expected 0", h.callCount(startkexMsg))
	}
}

// kth is a kex handler for testing.  It keeps track of how many
// times the handle functions are called.
type kth struct {
	calls map[string]int
}

func newKth() *kth {
	return &kth{calls: make(map[string]int)}
}

func (h *kth) callInc(name string) {
	cur := h.callCount(name)
	h.calls[name] = cur + 1
}

func (h *kth) callCount(name string) int {
	if cur, ok := h.calls[name]; !ok {
		return 0
	} else {
		return cur
	}
}

func (h *kth) StartKexSession(ctx *kex.Meta, id kex.StrongID) error {
	h.callInc(startkexMsg)
	return nil
}

func (h *kth) StartReverseKexSession(ctx *kex.Meta) error {
	h.callInc(startrevkexMsg)
	return nil
}

func (h *kth) Hello(ctx *kex.Meta, devID libkb.DeviceID, devKeyID libkb.KID) error {
	h.callInc(helloMsg)
	return nil
}

func (h *kth) PleaseSign(ctx *kex.Meta, eddsa libkb.NaclSigningKeyPublic, sig, devType, devDesc string) error {
	h.callInc(pleasesignMsg)
	return nil
}
func (h *kth) Done(ctx *kex.Meta, mt libkb.MerkleTriple) error {
	h.callInc(doneMsg)
	return nil
}

func (h *kth) RegisterTestDevice(srv kex.Handler, device libkb.DeviceID) error { return nil }

const (
	startkexMsg    = "startkex"
	startrevkexMsg = "startrevkex"
	helloMsg       = "hello"
	pleasesignMsg  = "pleasesign"
	doneMsg        = "done"
)
