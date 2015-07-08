package kex

import (
	"reflect"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

func testKexMeta(t *testing.T, username string) *Meta {
	sendID, err := libkb.NewDeviceID()
	if err != nil {
		t.Fatal(err)
	}
	recID, err := libkb.NewDeviceID()
	if err != nil {
		t.Fatal(err)
	}
	sid := [32]byte{1, 1, 1, 1, 1}
	m := NewMeta(libkb.UsernameToUID(username), sid, sendID, recID, DirectionYtoX)
	m.Seqno = 2 // why?
	return m
}

func testBody(t *testing.T) *Body {
	did, err := libkb.NewDeviceID()
	if err != nil {
		t.Fatal(err)
	}
	a := MsgArgs{
		DeviceID: did,
		DevKeyID: keybase1.KIDFromString("123456"),
	}

	return &Body{
		Name: StartKexMsg,
		Args: a,
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

	n, err := BodyDecode(enc)
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

	u := "kexnetuser"
	m := testKexMeta(t, u)
	b := testBody(t)
	msg := NewMsg(m, b)

	if msg.Body.Mac != nil {
		t.Fatalf("mac: %x, expected nil", msg.Body.Mac)
	}

	s, err := NewSecret(u)
	if err != nil {
		t.Fatal(err)
	}

	mac, err := msg.MacSum(s.Secret())
	if err != nil {
		t.Fatal(err)
	}
	msg.Body.Mac = mac

	// call should match existing hmac
	ok, err := msg.CheckMAC(s.Secret())
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Errorf("mac check failed")
	}

	// now, encode and decode and verify hmac still ok
	enc, err := msg.Body.Encode()
	if err != nil {
		t.Fatal(err)
	}

	n, err := BodyDecode(enc)
	if err != nil {
		t.Fatal(err)
	}

	decMsg := NewMsg(m, n)
	ok, err = decMsg.CheckMAC(s.Secret())
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Errorf("decoded body, mac check failed")
	}
}

func TestMACBad(t *testing.T) {
	tc := libkb.SetupTest(t, "kexnet")
	defer tc.Cleanup()

	u := "kexnetuser"
	m := testKexMeta(t, u)
	b := testBody(t)
	msg := NewMsg(m, b)

	if msg.Body.Mac != nil {
		t.Fatalf("mac: %x, expected nil", msg.Body.Mac)
	}

	s, err := NewSecret(u)
	if err != nil {
		t.Fatal(err)
	}

	mac, err := msg.MacSum(s.Secret())
	if err != nil {
		t.Fatal(err)
	}
	msg.Body.Mac = mac

	msg.Body.Mac[0] = ^msg.Body.Mac[0]
	ok, err := msg.CheckMAC(s.Secret())
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Error("CheckMAC() was ok, expected failure")
	}

	// now, encode and decode and verify hmac still doesn't match
	enc, err := msg.Body.Encode()
	if err != nil {
		t.Fatal(err)
	}

	n, err := BodyDecode(enc)
	if err != nil {
		t.Fatal(err)
	}

	decMsg := NewMsg(m, n)
	ok, err = decMsg.CheckMAC(s.Secret())
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Error("decoded msg CheckMAC() was ok, expected failure")
	}
}
