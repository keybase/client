package engine

import (
	"testing"

	"github.com/keybase/go/libkb"
)

// TestBasicMessage verifies that a message can be sent and
// received.
func TestBasicMessage(t *testing.T) {
	tc := libkb.SetupTest(t, "kexnet")
	defer tc.Cleanup()

	CreateAndSignupFakeUser(t, "login")

	h := newKth()
	s := NewKexSender()
	r := NewKexReceiver(h)

	sendID, err := libkb.NewDeviceID()
	if err != nil {
		t.Fatal(err)
	}
	recID, err := libkb.NewDeviceID()
	if err != nil {
		t.Fatal(err)
	}
	sid := [32]byte{1, 1, 1, 1, 1}
	ctx := &KexContext{KexMeta: KexMeta{Seqno: 2, StrongID: sid, Src: sendID, Dst: recID}}
	if err := s.StartKexSession(ctx, sid); err != nil {
		t.Fatal(err)
	}
	rctx := &KexContext{}
	if err := r.Receive(rctx); err != nil {
		t.Fatal(err)
	}
	if h.callCount("startkex") != 1 {
		t.Errorf("startkex call count: %d, expected 1", h.callCount("startkex"))
	}
}

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

func (h *kth) StartKexSession(ctx *KexContext, id KexStrongID) error {
	h.callInc("startkex")
	return nil
}
func (h *kth) StartReverseKexSession(ctx *KexContext) error                          { return nil }
func (h *kth) Hello(ctx *KexContext, devID libkb.DeviceID, devKeyID libkb.KID) error { return nil }
func (h *kth) PleaseSign(ctx *KexContext, eddsa libkb.NaclSigningKeyPublic, sig, devType, devDesc string) error {
	return nil
}
func (h *kth) Done(ctx *KexContext, mt libkb.MerkleTriple) error              { return nil }
func (h *kth) RegisterTestDevice(srv KexHandler, device libkb.DeviceID) error { return nil }
