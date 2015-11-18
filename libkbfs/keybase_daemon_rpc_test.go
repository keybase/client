package libkbfs

import (
	"fmt"
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	"golang.org/x/net/context"
)

type blockingClient struct {
	ctlChan chan struct{}
}

var _ keybase1.GenericClient = blockingClient{}

func (b blockingClient) Call(ctx context.Context, s string, args interface{},
	res interface{}) error {
	// Say we're ready, and wait for the signal to proceed.
	b.ctlChan <- struct{}{}
	<-b.ctlChan
	return nil
}

func newKeybaseDaemonRPCWithFakeClient(t *testing.T) (
	*KeybaseDaemonRPC, chan struct{}) {
	ctlChan := make(chan struct{})
	c := newKeybaseDaemonRPCWithClient(
		nil,
		cancelableClient{blockingClient{ctlChan}},
		logger.NewTestLogger(t))
	return c, ctlChan
}

// If we cancel the RPC before the RPC returns, the call should error quickly.
func TestKeybaseDaemonRPCIdentifyCanceled(t *testing.T) {
	c, ctlChan := newKeybaseDaemonRPCWithFakeClient(t)
	f := func(ctx context.Context) error {
		_, err := c.Identify(ctx, "")
		return err
	}
	testWithCanceledContext(t, context.Background(), ctlChan, ctlChan, f)
}

// If we cancel the RPC before the RPC returns, the call should error quickly.
func TestKeybaseDaemonRPCGetCurrentSessionCanceled(t *testing.T) {
	c, ctlChan := newKeybaseDaemonRPCWithFakeClient(t)
	f := func(ctx context.Context) error {
		_, err := c.CurrentSession(ctx, 0)
		return err
	}
	testWithCanceledContext(t, context.Background(), ctlChan, ctlChan, f)
}

// TODO: Add tests for Favorite* methods, too.

type fakeKeybaseClient struct {
	session                SessionInfo
	users                  map[keybase1.UID]UserInfo
	currentSessionCalled   bool
	identifyCalled         bool
	loadUserPlusKeysCalled bool
}

var _ keybase1.GenericClient = (*fakeKeybaseClient)(nil)

func (c *fakeKeybaseClient) Call(ctx context.Context, s string, args interface{},
	res interface{}) error {
	switch s {
	case "keybase.1.session.currentSession":
		*res.(*keybase1.Session) = keybase1.Session{
			Uid:             c.session.UID,
			Username:        "fake username",
			Token:           c.session.Token,
			DeviceSubkeyKid: c.session.CryptPublicKey.KID,
			DeviceSibkeyKid: c.session.VerifyingKey.KID,
		}

		c.currentSessionCalled = true
		return nil

	case "keybase.1.identify.identify":
		arg := args.([]interface{})[0].(keybase1.IdentifyArg)
		uidStr := strings.TrimPrefix(arg.UserAssertion, "uid:")
		if len(uidStr) == len(arg.UserAssertion) {
			return fmt.Errorf("Non-uid assertion %s", arg.UserAssertion)
		}

		uid := keybase1.UID(uidStr)
		userInfo, ok := c.users[uid]
		if !ok {
			return fmt.Errorf("Could not find user info for UID %s", uid)
		}

		*res.(*keybase1.IdentifyRes) = keybase1.IdentifyRes{
			User: &keybase1.User{
				Uid:      uid,
				Username: string(userInfo.Name),
			},
		}

		c.identifyCalled = true
		return nil

	case "keybase.1.user.loadUserPlusKeys":
		arg := args.([]interface{})[0].(keybase1.LoadUserPlusKeysArg)

		userInfo, ok := c.users[arg.Uid]
		if !ok {
			return fmt.Errorf("Could not find user info for UID %s", arg.Uid)
		}

		*res.(*keybase1.UserPlusKeys) = keybase1.UserPlusKeys{
			Uid:      arg.Uid,
			Username: string(userInfo.Name),
		}

		c.loadUserPlusKeysCalled = true
		return nil

	default:
		return fmt.Errorf("Unknown call: %s %v %v", s, args, res)
	}
}

const expectCall = true
const expectCached = false

func testCurrentSession(
	t *testing.T, client *fakeKeybaseClient, c *KeybaseDaemonRPC,
	expectedSession SessionInfo, expectedCalled bool) {
	client.currentSessionCalled = false

	ctx := context.Background()
	sessionID := 0
	session, err := c.CurrentSession(ctx, sessionID)
	if err != nil {
		t.Fatal(err)
	}

	if session != expectedSession {
		t.Errorf("Expected %v, got %v", expectedSession, session)
	}

	if client.currentSessionCalled != expectedCalled {
		t.Errorf("Expected CurrentSession called = %t, got %t",
			expectedCalled, client.currentSessionCalled)
	}
}

// Test that the session cache works and is invalidated as expected.
func TestKeybaseDaemonSessionCache(t *testing.T) {
	k := MakeLocalUserCryptPublicKeyOrBust(
		libkb.NormalizedUsername("fake username"))
	v := MakeLocalUserVerifyingKeyOrBust(
		libkb.NormalizedUsername("fake username"))
	session := SessionInfo{
		UID:            keybase1.UID("fake uid"),
		Token:          "fake token",
		CryptPublicKey: k,
		VerifyingKey:   v,
	}

	client := &fakeKeybaseClient{session: session}
	c := newKeybaseDaemonRPCWithClient(
		nil, client, logger.NewTestLogger(t))

	// Should fill cache.
	testCurrentSession(t, client, c, session, expectCall)

	// Should be cached.
	testCurrentSession(t, client, c, session, expectCached)

	// Should invalidate cache.
	err := c.LoggedOut(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	// Should fill cache again.
	testCurrentSession(t, client, c, session, expectCall)

	// Should be cached again.
	testCurrentSession(t, client, c, session, expectCached)
}

func testLoadUserPlusKeys(
	t *testing.T, client *fakeKeybaseClient, c *KeybaseDaemonRPC,
	uid keybase1.UID, expectedName libkb.NormalizedUsername,
	expectedCalled bool) {
	client.loadUserPlusKeysCalled = false

	ctx := context.Background()
	info, err := c.LoadUserPlusKeys(ctx, uid)
	if err != nil {
		t.Fatal(err)
	}

	if info.Name != expectedName {
		t.Errorf("Expected name %s, got %s", expectedName, info.Name)
	}

	if client.loadUserPlusKeysCalled != expectedCalled {
		t.Errorf("Expected LoadUserPlusKeys called = %t, got %t",
			expectedCalled, client.loadUserPlusKeysCalled)
	}
}

func testIdentify(
	t *testing.T, client *fakeKeybaseClient, c *KeybaseDaemonRPC,
	uid keybase1.UID, expectedName libkb.NormalizedUsername,
	expectedCalled bool) {
	client.identifyCalled = false

	ctx := context.Background()
	info, err := c.Identify(ctx, "uid:"+string(uid))
	if err != nil {
		t.Fatal(err)
	}

	if info.Name != expectedName {
		t.Errorf("Expected name %s, got %s", expectedName, info.Name)
	}

	if client.identifyCalled != expectedCalled {
		t.Errorf("Expected Identify called = %t, got %t",
			expectedCalled, client.identifyCalled)
	}
}

// Test that the user cache works and is invalidated as expected.
func TestKeybaseDaemonUserCache(t *testing.T) {
	uid1 := keybase1.UID("uid1")
	uid2 := keybase1.UID("uid2")
	name1 := libkb.NewNormalizedUsername("name1")
	name2 := libkb.NewNormalizedUsername("name2")
	users := map[keybase1.UID]UserInfo{
		uid1: {Name: name1},
		uid2: {Name: name2},
	}
	client := &fakeKeybaseClient{users: users}
	c := newKeybaseDaemonRPCWithClient(
		nil, client, logger.NewTestLogger(t))

	// Should fill cache.
	testLoadUserPlusKeys(t, client, c, uid1, name1, expectCall)

	// Should be cached.
	testLoadUserPlusKeys(t, client, c, uid1, name1, expectCached)

	// Should fill cache.
	testIdentify(t, client, c, uid2, name2, expectCall)

	// Should be cached.
	testLoadUserPlusKeys(t, client, c, uid2, name2, expectCached)

	// Should not be cached.
	testIdentify(t, client, c, uid2, name2, expectCall)

	// Should invalidate cache for uid1.
	err := c.UserChanged(context.Background(), uid1)
	if err != nil {
		t.Fatal(err)
	}

	// Should fill cache again.
	testLoadUserPlusKeys(t, client, c, uid1, name1, expectCall)

	// Should be cached again.
	testLoadUserPlusKeys(t, client, c, uid1, name1, expectCached)

	// Should still be cached.
	testLoadUserPlusKeys(t, client, c, uid2, name2, expectCached)

	// Should invalidate cache for uid2.
	err = c.UserChanged(context.Background(), uid2)
	if err != nil {
		t.Fatal(err)
	}

	// Should fill cache again.
	testLoadUserPlusKeys(t, client, c, uid2, name2, expectCall)

	// Should be cached again.
	testLoadUserPlusKeys(t, client, c, uid2, name2, expectCached)
}
