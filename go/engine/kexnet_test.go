package engine

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"reflect"
	"testing"

	"github.com/keybase/client/go/libkb"
)

func testKexContext(t *testing.T, username string) *KexContext {
	sendID, err := libkb.NewDeviceID()
	if err != nil {
		t.Fatal(err)
	}
	recID, err := libkb.NewDeviceID()
	if err != nil {
		t.Fatal(err)
	}
	sid := [32]byte{1, 1, 1, 1, 1}
	return &KexContext{KexMeta: KexMeta{UID: libkb.UsernameToUID(username), Seqno: 2, StrongID: sid, Src: sendID, Dst: recID}}
}

func testBody(t *testing.T) *KexBody {
	did, err := libkb.NewDeviceID()
	if err != nil {
		t.Fatal(err)
	}
	a := MsgArgs{
		DeviceID: did,
		DevKeyID: libkb.KID([]byte{1, 2, 3, 4, 5}),
	}

	return &KexBody{
		Name: startkexMsg,
		Args: a,
	}
}

// TestBasicMessage verifies that a message can be sent and
// received.
func TestBasicMessage(t *testing.T) {
	tc := libkb.SetupTest(t, "kexnet")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(t, "login")

	h := newKth()
	s := NewKexSender()
	r := NewKexReceiver(h)

	ctx := testKexContext(t, fu.Username)
	if err := s.StartKexSession(ctx, ctx.StrongID); err != nil {
		t.Fatal(err)
	}
	rctx := &KexContext{}
	if err := r.Receive(rctx); err != nil {
		t.Fatal(err)
	}
	if h.callCount(startkexMsg) != 1 {
		t.Errorf("startkex call count: %d, expected 1", h.callCount(startkexMsg))
	}
}

// TestEncode checks that the decoding of an encoded message
// matches the original.
func TestEncode(t *testing.T) {
	m := testBody(t)
	enc, err := m.Encode()
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("encoded: %s", enc)

	n, err := KexBodyDecode(enc)
	if err != nil {
		t.Fatal(err)
	}

	if !reflect.DeepEqual(m, n) {
		t.Errorf("decoded msg (%+v) doesn't match original (%+v)", n, m)
	}
}

func TestMAC(t *testing.T) {
	tc := libkb.SetupTest(t, "kexnet")
	defer tc.Cleanup()

	ctx := testKexContext(t, "kexnetuser")
	b := testBody(t)
	msg := NewKexMsg(ctx, b)

	if msg.Mac != nil {
		t.Fatalf("mac: %x, expected nil", msg.Mac)
	}

	mac, err := msg.MacSum()
	if err != nil {
		t.Fatal(err)
	}
	msg.Mac = mac

	// call should match existing hmac
	ok, err := msg.CheckMAC()
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Errorf("mac check failed")
	}

	// now, encode and decode and verify hmac still ok
	enc, err := msg.Encode()
	if err != nil {
		t.Fatal(err)
	}

	n, err := KexBodyDecode(enc)
	if err != nil {
		t.Fatal(err)
	}

	decMsg := NewKexMsg(ctx, n)
	ok, err = decMsg.CheckMAC()
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Errorf("decoded body, mac check failed")
	}
}

func TestHMAC(t *testing.T) {
	secret := [32]byte{1, 1, 1, 1, 1}
	data := "8aa44172677388a744657644657363a0a84465764b65794944c0a744657654797065a0a84465766963654944b000000000000000000000000000000000ac4d65726b6c65547269706c6583a64c696e6b4964c0a55365716e6f00a55369674964c0a3536967a0aa5369676e696e674b6579da00200000000000000000000000000000000000000000000000000000000000000000a85374726f6e674944da00200101010101000000000000000000000000000000000000000000000000000000a9446972656374696f6e01a3447374b0ff2f2d60ade554684b7221d25a246718a34d6163c0a44e616d65a873746172746b6578a55365716e6f02a3537263b0d9e7c081bd29a99bbf8f05f55d5fe118a85374726f6e674944da00200101010101000000000000000000000000000000000000000000000000000000a3554944b02414879a8ebe2e77b0e078218b5ea119a65765616b4944b000000000000000000000000000000000"
	b, err := hex.DecodeString(data)
	if err != nil {
		t.Fatal(err)
	}
	mac := hmac.New(sha256.New, secret[:])
	_, err = mac.Write(b)
	if err != nil {
		t.Fatal(err)
	}
	sum := mac.Sum(nil)

	output, err := hex.DecodeString("f8fd43df66f1263371c17b95f70d84b61e0776eb9a4663c61c17744083fd3af6")
	if err != nil {
		t.Fatal(err)
	}
	if !hmac.Equal(sum, output) {
		t.Errorf("hmac: %x, expected: %x", sum, output)
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

func (h *kth) StartKexSession(ctx *KexContext, id KexStrongID) error {
	h.callInc(startkexMsg)
	return nil
}

func (h *kth) StartReverseKexSession(ctx *KexContext) error {
	h.callInc(startrevkexMsg)
	return nil
}

func (h *kth) Hello(ctx *KexContext, devID libkb.DeviceID, devKeyID libkb.KID) error {
	h.callInc(helloMsg)
	return nil
}

func (h *kth) PleaseSign(ctx *KexContext, eddsa libkb.NaclSigningKeyPublic, sig, devType, devDesc string) error {
	h.callInc(pleasesignMsg)
	return nil
}
func (h *kth) Done(ctx *KexContext, mt libkb.MerkleTriple) error {
	h.callInc(doneMsg)
	return nil
}

func (h *kth) RegisterTestDevice(srv KexHandler, device libkb.DeviceID) error { return nil }
