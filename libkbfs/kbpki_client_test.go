package libkbfs

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/net/context"
)

type FakeKBPKIClient struct {
	Local   *KBPKILocal
	ctlChan chan struct{}
}

func NewFakeKBPKIClient(loggedIn keybase1.UID, users []LocalUser,
	ctlChan chan struct{}) *FakeKBPKIClient {
	return &FakeKBPKIClient{
		Local:   NewKBPKIMemory(loggedIn, users),
		ctlChan: ctlChan,
	}
}

func (fc FakeKBPKIClient) maybeWaitOnChannel() {
	if fc.ctlChan != nil {
		// say we're ready, and wait for the signal to proceed
		fc.ctlChan <- struct{}{}
		<-fc.ctlChan
	}
}

func (fc FakeKBPKIClient) Call(s string, args interface{}, res interface{}) error {
	switch s {
	case "keybase.1.identify.identify":
		fc.maybeWaitOnChannel()
		identifyArgs := args.([]interface{})[0].(keybase1.IdentifyArg)
		uid, ok := fc.Local.Asserts[identifyArgs.UserAssertion]
		if !ok {
			return fmt.Errorf("Could not find user for %s", identifyArgs.UserAssertion)
		}
		user := fc.Local.Users[uid]
		identifyRes := res.(*keybase1.IdentifyRes)
		identifyRes.User = &keybase1.User{
			Uid:      uid,
			Username: string(user.Name),
		}
		identifyRes.PublicKeys = user.GetPublicKeys()
		return nil

	case "keybase.1.session.currentSession":
		fc.maybeWaitOnChannel()
		ctx := context.Background()
		name, err := fc.Local.GetNormalizedUsername(ctx, fc.Local.CurrentUID)
		if err != nil {
			return err
		}

		deviceSubkey, err := fc.Local.GetCurrentCryptPublicKey(ctx)
		if err != nil {
			return err
		}

		session := res.(*keybase1.Session)
		session.Uid = fc.Local.CurrentUID
		session.Username = string(name)
		session.DeviceSubkeyKid = deviceSubkey.KID

	default:
		return fmt.Errorf("Unknown call: %s %v %v", s, args, res)
	}
	return nil
}

func TestKBPKIClientResolveAssertion(t *testing.T) {
	users := []libkb.NormalizedUsername{"pc"}
	expectedUID := keybase1.MakeTestUID(1)
	fc := NewFakeKBPKIClient(expectedUID, MakeLocalUsers(users), nil)
	c := newKBPKIClientWithClient(fc, logger.NewTestLogger(t))

	u, err := c.ResolveAssertion(context.Background(), "pc")
	if err != nil {
		t.Fatal(err)
	}
	if u == keybase1.UID("") {
		t.Fatal("empty user")
	}
}

func TestKBPKIClientGetNormalizedUsername(t *testing.T) {
	users := []libkb.NormalizedUsername{"test_name"}
	fc := NewFakeKBPKIClient(keybase1.MakeTestUID(1),
		MakeLocalUsers(users), nil)
	c := newKBPKIClientWithClient(fc, logger.NewTestLogger(t))

	name, err := c.GetNormalizedUsername(context.Background(), keybase1.MakeTestUID(1))
	if err != nil {
		t.Fatal(err)
	}
	if name == libkb.NormalizedUsername("") {
		t.Fatal("empty user")
	}
}

// If we cancel the RPC before the RPC returns, the call should error quickly.
func TestKBPKIClientGetUserCanceled(t *testing.T) {
	users := []libkb.NormalizedUsername{"test_name"}
	ctlChan := make(chan struct{})
	fc := NewFakeKBPKIClient(keybase1.MakeTestUID(1),
		MakeLocalUsers(users), ctlChan)
	c := newKBPKIClientWithClient(fc, logger.NewTestLogger(t))

	f := func(ctx context.Context) error {
		_, err := c.GetNormalizedUsername(ctx, keybase1.MakeTestUID(1))
		return err
	}
	testWithCanceledContext(t, context.Background(), ctlChan, ctlChan, f)
}

func TestKBPKIClientHasVerifyingKey(t *testing.T) {
	users := []libkb.NormalizedUsername{"test_name"}
	localUsers := MakeLocalUsers(users)
	fc := NewFakeKBPKIClient(keybase1.MakeTestUID(1), localUsers, nil)
	c := newKBPKIClientWithClient(fc, logger.NewTestLogger(t))

	err := c.HasVerifyingKey(context.Background(), keybase1.MakeTestUID(1),
		localUsers[0].VerifyingKeys[0])
	if err != nil {
		t.Error(err)
	}

	err = c.HasVerifyingKey(context.Background(), keybase1.MakeTestUID(1),
		VerifyingKey{})
	if err == nil {
		t.Error("HasVerifyingKey unexpectedly succeeded")
	}
}

func TestKBPKIClientGetCryptPublicKeys(t *testing.T) {
	users := []libkb.NormalizedUsername{"test_name"}
	localUsers := MakeLocalUsers(users)
	fc := NewFakeKBPKIClient(keybase1.MakeTestUID(1), localUsers, nil)
	c := newKBPKIClientWithClient(fc, logger.NewTestLogger(t))

	cryptPublicKeys, err := c.GetCryptPublicKeys(context.Background(),
		keybase1.MakeTestUID(1))
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
	users := []libkb.NormalizedUsername{"test_name1", "test_name2"}
	localUsers := MakeLocalUsers(users)
	fc := NewFakeKBPKIClient(keybase1.MakeTestUID(2), localUsers, nil)
	c := newKBPKIClientWithClient(fc, logger.NewTestLogger(t))

	currPublicKey, err := c.GetCurrentCryptPublicKey(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	kid := currPublicKey.KID
	expectedKID := localUsers[1].GetCurrentCryptPublicKey().KID
	if kid != expectedKID {
		t.Errorf("Expected %s, got %s", expectedKID, kid)
	}
}

// If we cancel the RPC before the RPC returns, the call should error quickly.
func TestKBPKIClientGetCurrentCryptPublicKeyCanceled(t *testing.T) {
	users := []libkb.NormalizedUsername{"test_name1", "test_name2"}
	localUsers := MakeLocalUsers(users)
	ctlChan := make(chan struct{})
	fc := NewFakeKBPKIClient(keybase1.MakeTestUID(2), localUsers, ctlChan)
	c := newKBPKIClientWithClient(fc, logger.NewTestLogger(t))

	f := func(ctx context.Context) error {
		_, err := c.GetCurrentCryptPublicKey(ctx)
		return err
	}
	testWithCanceledContext(t, context.Background(), ctlChan, ctlChan, f)
}
