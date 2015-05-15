package libkbfs

import (
	"fmt"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"testing"
)

type FakeKBPKIClient struct {
	Local *KBPKILocal
}

func NewFakeKBPKIClient(loggedIn libkb.UID, users []LocalUser) *FakeKBPKIClient {
	return &FakeKBPKIClient{
		Local: NewKBPKILocal(loggedIn, users),
	}
}

func (fc FakeKBPKIClient) Call(s string, args interface{}, res interface{}) error {
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

		deviceSubkey, err := fc.Local.GetDeviceSubkey()
		if err != nil {
			return err
		}

		session := res.(*keybase1.Session)
		session.Uid = keybase1.UID(user.GetUID())
		session.Username = user.GetName()
		session.DeviceSubkeyKid = deviceSubkey.GetKid().String()

	default:
		return fmt.Errorf("Unknown call: %s %v %v", s, args, res)
	}
	return nil
}

func TestKBPKIClientResolveAssertion(t *testing.T) {
	fc := NewFakeKBPKIClient(libkb.UID{1}, []LocalUser{
		LocalUser{
			Name: "pc",
			Uid:  libkb.UID{1},
		},
	})
	c := newKBPKIClientWithClient(nil, fc)

	u, err := c.ResolveAssertion("pc")
	if err != nil {
		t.Fatal(err)
	}
	if u == nil {
		t.Fatal("nil user")
	}
}

func TestKBPKIClientGetUser(t *testing.T) {
	fc := NewFakeKBPKIClient(libkb.UID{1}, []LocalUser{
		LocalUser{
			Name: "test_name",
			Uid:  libkb.UID{1},
		},
	})
	c := newKBPKIClientWithClient(nil, fc)

	u, err := c.GetUser(libkb.UID{1})
	if err != nil {
		t.Fatal(err)
	}
	if u == nil {
		t.Fatal("nil user")
	}
}

func TestKBPKIClientGetDeviceKeys(t *testing.T) {
	sibkey, err := libkb.GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	subkey, err := libkb.GenerateNaclSigningKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	fc := NewFakeKBPKIClient(libkb.UID{1}, []LocalUser{
		LocalUser{
			Name:    "test_name",
			Uid:     libkb.UID{1},
			Sibkeys: []Key{sibkey},
			Subkeys: []Key{subkey},
		},
	})
	c := newKBPKIClientWithClient(nil, fc)

	sibkeys, err := c.GetDeviceSibkeys(libkb.NewUserThin("unused_name", libkb.UID{1}))
	if err != nil {
		t.Fatal(err)
	}

	if len(sibkeys) != 1 {
		t.Fatalf("Expected 1 sibkey, got %d", len(sibkeys))
	}

	if !sibkeys[0].GetKid().Eq(sibkey.GetKid()) {
		t.Errorf("Expected %s, got %s", sibkey.GetKid(), sibkeys[0].GetKid())
	}

	subkeys, err := c.GetDeviceSubkeys(libkb.NewUserThin("unused_name", libkb.UID{1}))
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

func TestKBPKIClientGetDeviceSubkey(t *testing.T) {
	subkey1 := NewFakeBoxPublicKeyOrBust("subkey1")
	subkey2 := NewFakeBoxPublicKeyOrBust("subkey2")
	fc := NewFakeKBPKIClient(libkb.UID{2}, []LocalUser{
		LocalUser{
			Name:         "test_name1",
			Uid:          libkb.UID{1},
			DeviceSubkey: subkey1,
		},
		LocalUser{
			Name:         "test_name2",
			Uid:          libkb.UID{2},
			DeviceSubkey: subkey2,
		},
	})
	c := newKBPKIClientWithClient(nil, fc)

	deviceSubkey, err := c.GetDeviceSubkey()
	if err != nil {
		t.Fatal(err)
	}

	expectedKid := libkb.KID(subkey2.GetKid())
	kid := libkb.KID(deviceSubkey.GetKid())
	if !kid.Eq(expectedKid) {
		t.Errorf("Expected %s, got %s", expectedKid, kid)
	}
}
