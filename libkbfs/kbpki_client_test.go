package libkbfs

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/net/context"
)

func makeTestKBPKIClient(t *testing.T) (
	client *KBPKIClient, currentUID keybase1.UID, users []LocalUser) {
	currentUID = keybase1.MakeTestUID(1)
	names := []libkb.NormalizedUsername{"test_name1", "test_name2"}
	users = MakeLocalUsers(names)
	daemon := NewKeybaseDaemonMemory(currentUID, users)
	config := &ConfigLocal{codec: NewCodecMsgpack(), daemon: daemon}
	setTestLogger(config, t)
	return NewKBPKIClient(config), currentUID, users
}

func TestKBPKIClientResolveAssertion(t *testing.T) {
	c, _, _ := makeTestKBPKIClient(t)

	u, err := c.ResolveAssertion(context.Background(), "test_name1")
	if err != nil {
		t.Fatal(err)
	}
	if u == keybase1.UID("") {
		t.Fatal("empty user")
	}
}

func TestKBPKIClientGetNormalizedUsername(t *testing.T) {
	c, _, _ := makeTestKBPKIClient(t)

	name, err := c.GetNormalizedUsername(context.Background(), keybase1.MakeTestUID(1))
	if err != nil {
		t.Fatal(err)
	}
	if name == libkb.NormalizedUsername("") {
		t.Fatal("empty user")
	}
}

func TestKBPKIClientHasVerifyingKey(t *testing.T) {
	c, _, localUsers := makeTestKBPKIClient(t)

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
	c, _, localUsers := makeTestKBPKIClient(t)

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
	c, _, localUsers := makeTestKBPKIClient(t)

	currPublicKey, err := c.GetCurrentCryptPublicKey(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	kid := currPublicKey.KID
	expectedKID := localUsers[0].GetCurrentCryptPublicKey().KID
	if kid != expectedKID {
		t.Errorf("Expected %s, got %s", expectedKID, kid)
	}
}
