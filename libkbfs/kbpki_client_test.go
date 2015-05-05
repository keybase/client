package libkbfs

import (
	"fmt"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"testing"
)

type FakeClient struct {
	Local *KBPKILocal
}

func NewFakeClient(loggedIn libkb.UID, users []LocalUser) *FakeClient {
	return &FakeClient{
		Local: NewKBPKILocal(loggedIn, users),
	}
}

func (fc FakeClient) Call(s string, args interface{}, res interface{}) error {
	switch s {
	case "keybase.1.identify.identify":
		identifyArgs := args.([]interface{})[0].(keybase1.IdentifyArg)
		uid, ok := fc.Local.Asserts[identifyArgs.UserAssertion]
		if !ok {
			return fmt.Errorf("Could not find user for %s", identifyArgs.UserAssertion)
		}
		user := fc.Local.Users[uid]
		identifyRes := res.(*keybase1.IdentifyRes)
		identifyRes.User = &keybase1.User{
			Uid:        keybase1.UID(uid),
			Username:   user.Name,
			PublicKeys: user.GetPublicKeys(),
		}
		return nil

	case "keybase.1.session.currentSession":
		user, err := fc.Local.GetUser(fc.Local.LoggedIn)
		if err != nil {
			return err
		}
		session := res.(*keybase1.Session)
		session.Uid = keybase1.UID(user.GetUid())
		session.Username = user.GetName()
		session.DeviceSubkeyKid, err = fc.Local.GetDeviceSubkeyKid()
		if err != nil {
			return err
		}

	default:
		return fmt.Errorf("Unknown call: %s %v %v", s, args, res)
	}
	return nil
}

func TestClientResolveAssertion(t *testing.T) {
	fc := NewFakeClient(libkb.UID{1}, []LocalUser{
		LocalUser{
			Name: "pc",
			Uid:  libkb.UID{1},
		},
	})
	c := newKBPKIClientWithClient(fc)

	u, err := c.ResolveAssertion("pc")
	if err != nil {
		t.Fatal(err)
	}
	if u == nil {
		t.Fatal("nil user")
	}
}

func TestClientGetUser(t *testing.T) {
	fc := NewFakeClient(libkb.UID{1}, []LocalUser{
		LocalUser{
			Name: "test_name",
			Uid:  libkb.UID{1},
		},
	})
	c := newKBPKIClientWithClient(fc)

	u, err := c.GetUser(libkb.UID{1})
	if err != nil {
		t.Fatal(err)
	}
	if u == nil {
		t.Fatal("nil user")
	}
}

func TestClientGetDeviceKeys(t *testing.T) {
	sibkey, err := libkb.GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	subkey, err := libkb.GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	fc := NewFakeClient(libkb.UID{1}, []LocalUser{
		LocalUser{
			Name:    "test_name",
			Uid:     libkb.UID{1},
			SibKeys: []Key{sibkey},
			SubKeys: []Key{subkey},
		},
	})
	c := newKBPKIClientWithClient(fc)

	sibkeys, err := c.GetDeviceSibKeys(libkb.NewUserThin("unused_name", libkb.UID{1}))
	if err != nil {
		t.Fatal(err)
	}

	if len(sibkeys) != 1 {
		t.Fatalf("Expected 1 sibkey, got %d", len(sibkeys))
	}

	if !sibkeys[0].GetKid().Eq(sibkey.GetKid()) {
		t.Errorf("Expected %s, got %s", sibkey.GetKid(), sibkeys[0].GetKid())
	}

	subkeys, err := c.GetDeviceSubKeys(libkb.NewUserThin("unused_name", libkb.UID{1}))
	if err != nil {
		t.Fatal(err)
	}

	if len(subkeys) != 1 {
		t.Fatalf("Expected 1 subkey, got %d", len(subkeys))
	}

	if !subkeys[0].GetKid().Eq(subkey.GetKid()) {
		t.Errorf("Expected %s, got %s", subkey.GetKid(), subkeys[0].GetKid())
	}
}

func TestClientGetDeviceSubkeyKid(t *testing.T) {
	kid1 := KID("kid1 with at least 12 bytes")
	kid2 := KID("kid2 with at least 12 bytes")
	fc := NewFakeClient(libkb.UID{2}, []LocalUser{
		LocalUser{
			Name:            "test_name1",
			Uid:             libkb.UID{1},
			DeviceSubkeyKid: kid1,
		},
		LocalUser{
			Name:            "test_name2",
			Uid:             libkb.UID{2},
			DeviceSubkeyKid: kid2,
		},
	})
	c := newKBPKIClientWithClient(fc)

	deviceSubkeyKid, err := c.GetDeviceSubkeyKid()
	if err != nil {
		t.Fatal(err)
	}

	if !libkb.KID(deviceSubkeyKid).Eq(libkb.KID(kid2)) {
		t.Errorf("Expected %s, got %s", kid2, deviceSubkeyKid)
	}
}
