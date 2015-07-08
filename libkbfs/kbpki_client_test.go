package libkbfs

import (
	"fmt"
	"testing"

	keybase1 "github.com/keybase/client/protocol/go"
)

type FakeKBPKIClient struct {
	Local *KBPKILocal
}

func NewFakeKBPKIClient(loggedIn keybase1.UID, users []LocalUser) *FakeKBPKIClient {
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
			Uid:        uid,
			Username:   user.Name,
			PublicKeys: user.GetPublicKeys(),
		}
		return nil

	case "keybase.1.session.currentSession":
		user, err := fc.Local.GetUser(fc.Local.LoggedIn)
		if err != nil {
			return err
		}

		deviceSubkey, err := fc.Local.GetCurrentCryptPublicKey()
		if err != nil {
			return err
		}

		session := res.(*keybase1.Session)
		session.Uid = keybase1.UID(user.GetUID())
		session.Username = user.GetName()
		session.DeviceSubkeyKid = deviceSubkey.KID

	default:
		return fmt.Errorf("Unknown call: %s %v %v", s, args, res)
	}
	return nil
}

func TestKBPKIClientResolveAssertion(t *testing.T) {
	users := []string{"pc"}
	expectedUID := keybase1.MakeTestUID(1)
	fc := NewFakeKBPKIClient(expectedUID, MakeLocalUsers(users))
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
	users := []string{"test_name"}
	fc := NewFakeKBPKIClient(keybase1.MakeTestUID(1), MakeLocalUsers(users))
	c := newKBPKIClientWithClient(nil, fc)

	u, err := c.GetUser(keybase1.MakeTestUID(1))
	if err != nil {
		t.Fatal(err)
	}
	if u == nil {
		t.Fatal("nil user")
	}
}

func TestKBPKIClientHasVerifyingKey(t *testing.T) {
	users := []string{"test_name"}
	localUsers := MakeLocalUsers(users)
	fc := NewFakeKBPKIClient(keybase1.MakeTestUID(1), localUsers)
	c := newKBPKIClientWithClient(nil, fc)

	err := c.HasVerifyingKey(keybase1.MakeTestUID(1), localUsers[0].VerifyingKeys[0])
	if err != nil {
		t.Error(err)
	}

	err = c.HasVerifyingKey(keybase1.MakeTestUID(1), VerifyingKey{})
	if err == nil {
		t.Error("HasVerifyingKey unexpectedly succeeded")
	}
}

func TestKBPKIClientGetCryptPublicKeys(t *testing.T) {
	users := []string{"test_name"}
	localUsers := MakeLocalUsers(users)
	fc := NewFakeKBPKIClient(keybase1.MakeTestUID(1), localUsers)
	c := newKBPKIClientWithClient(nil, fc)

	cryptPublicKeys, err := c.GetCryptPublicKeys(keybase1.MakeTestUID(1))
	if err != nil {
		t.Fatal(err)
	}

	if len(cryptPublicKeys) != 1 {
		t.Fatalf("Expected 1 crypt public key, got %d", len(cryptPublicKeys))
	}

	kid := cryptPublicKeys[0].KID
	expectedKID := localUsers[0].CryptPublicKeys[0].KID
	if kid != expectedKID {
		t.Errorf("Expected %s, got %s", expectedKID, kid)
	}
}

func TestKBPKIClientGetCurrentCryptPublicKey(t *testing.T) {
	users := []string{"test_name1", "test_name2"}
	localUsers := MakeLocalUsers(users)
	fc := NewFakeKBPKIClient(keybase1.MakeTestUID(2), localUsers)
	c := newKBPKIClientWithClient(nil, fc)

	currPublicKey, err := c.GetCurrentCryptPublicKey()
	if err != nil {
		t.Fatal(err)
	}

	kid := currPublicKey.KID
	expectedKID := localUsers[1].GetCurrentCryptPublicKey().KID
	if kid != expectedKID {
		t.Errorf("Expected %s, got %s", expectedKID, kid)
	}
}
