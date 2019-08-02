// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/test/clocktest"
	"github.com/keybase/client/go/kbfs/tlf"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

// If we cancel the RPC before the RPC returns, the call should error quickly.
func TestKeybaseDaemonRPCIdentifyCanceled(t *testing.T) {
	serverConn, conn := rpc.MakeConnectionForTest(t)
	daemon := newKeybaseDaemonRPCWithClient(
		nil,
		conn.GetClient(),
		logger.NewTestLogger(t))

	f := func(ctx context.Context) error {
		_, _, err := daemon.Identify(
			ctx, "", "", keybase1.OfflineAvailability_NONE)
		return err
	}
	testRPCWithCanceledContext(t, serverConn, f)
}

// If we cancel the RPC before the RPC returns, the call should error quickly.
func TestKeybaseDaemonRPCGetCurrentSessionCanceled(t *testing.T) {
	serverConn, conn := rpc.MakeConnectionForTest(t)
	daemon := newKeybaseDaemonRPCWithClient(
		nil,
		conn.GetClient(),
		logger.NewTestLogger(t))

	f := func(ctx context.Context) error {
		_, err := daemon.CurrentSession(ctx, 0)
		return err
	}
	testRPCWithCanceledContext(t, serverConn, f)
}

// TODO: Add tests for Favorite* methods, too.

type fakeKeybaseClient struct {
	session                     idutil.SessionInfo
	users                       map[keybase1.UID]idutil.UserInfo
	currentSessionCalled        bool
	identifyCalled              bool
	loadUserPlusKeysCalled      bool
	loadAllPublicKeysUnverified bool
	editResponse                keybase1.FSEditListArg
}

var _ rpc.GenericClient = (*fakeKeybaseClient)(nil)

func (c *fakeKeybaseClient) Call(ctx context.Context, s string, args interface{}, res interface{}) error {
	return c.call(ctx, s, args, res)
}

func (c *fakeKeybaseClient) CallCompressed(ctx context.Context, s string, args interface{}, res interface{}, _ rpc.CompressionType) error {
	return c.call(ctx, s, args, res)
}

func (c *fakeKeybaseClient) call(ctx context.Context, s string, args interface{}, res interface{}) error {
	switch s {
	case "keybase.1.session.currentSession":
		*res.(*keybase1.Session) = keybase1.Session{
			Uid:             c.session.UID,
			Username:        "fake username",
			DeviceSubkeyKid: c.session.CryptPublicKey.KID(),
			DeviceSibkeyKid: c.session.VerifyingKey.KID(),
		}

		c.currentSessionCalled = true
		return nil

	case "keybase.1.identify.identifyLite":
		arg := args.([]interface{})[0].(keybase1.IdentifyLiteArg)
		uidStr := strings.TrimPrefix(arg.Assertion, "uid:")
		if len(uidStr) == len(arg.Assertion) {
			return fmt.Errorf("Non-uid assertion %s", arg.Assertion)
		}

		uid := keybase1.UID(uidStr)
		userInfo, ok := c.users[uid]
		if !ok {
			return fmt.Errorf("Could not find user info for UID %s", uid)
		}

		*res.(*keybase1.IdentifyLiteRes) = keybase1.IdentifyLiteRes{
			Ul: keybase1.UserOrTeamLite{
				Id:   uid.AsUserOrTeam(),
				Name: string(userInfo.Name),
			},
		}

		c.identifyCalled = true
		return nil

	case "keybase.1.user.loadUserPlusKeysV2":
		arg := args.([]interface{})[0].(keybase1.LoadUserPlusKeysV2Arg)

		userInfo, ok := c.users[arg.Uid]
		if !ok {
			return fmt.Errorf("Could not find user info for UID %s", arg.Uid)
		}

		*res.(*keybase1.UserPlusKeysV2AllIncarnations) =
			keybase1.UserPlusKeysV2AllIncarnations{
				Current: keybase1.UserPlusKeysV2{
					Uid:      arg.Uid,
					Username: string(userInfo.Name),
				},
			}

		c.loadUserPlusKeysCalled = true
		return nil

	case "keybase.1.user.loadAllPublicKeysUnverified":
		pk := keybase1.PublicKey{
			KID: kbfscrypto.MakeFakeVerifyingKeyOrBust("foo").KID(),
		}
		*res.(*[]keybase1.PublicKey) = []keybase1.PublicKey{pk}

		c.loadAllPublicKeysUnverified = true
		return nil

	case "keybase.1.kbfs.FSEditList":
		c.editResponse = args.([]interface{})[0].(keybase1.FSEditListArg)
		return nil

	default:
		return fmt.Errorf("Unknown call: %s %v %v", s, args, res)
	}
}

func (c *fakeKeybaseClient) Notify(_ context.Context, s string, args interface{}) error {
	return fmt.Errorf("Unknown notify: %s %v", s, args)
}

const expectCall = true
const expectCached = false

func testCurrentSession(
	t *testing.T, client *fakeKeybaseClient, c *KeybaseDaemonRPC,
	expectedSession idutil.SessionInfo, expectedCalled bool) {
	client.currentSessionCalled = false

	ctx := context.Background()
	sessionID := 0
	session, err := c.CurrentSession(ctx, sessionID)
	require.NoError(t, err)

	assert.Equal(t, expectedSession, session)
	assert.Equal(t, expectedCalled, client.currentSessionCalled)
}

// Test that the session cache works and is invalidated as expected.
func TestKeybaseDaemonSessionCache(t *testing.T) {
	name := kbname.NormalizedUsername("fake username")
	k := idutil.MakeLocalUserCryptPublicKeyOrBust(name)
	v := idutil.MakeLocalUserVerifyingKeyOrBust(name)
	session := idutil.SessionInfo{
		Name:           name,
		UID:            keybase1.MakeTestUID(1),
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
	require.NoError(t, err)

	// Should fill cache again.
	testCurrentSession(t, client, c, session, expectCall)

	// Should be cached again.
	testCurrentSession(t, client, c, session, expectCached)

	// Should invalidate cache.
	c.OnDisconnected(context.Background(), rpc.UsingExistingConnection)

	// Should fill cache again.
	testCurrentSession(t, client, c, session, expectCall)
}

func testLoadUserPlusKeys(
	t *testing.T, client *fakeKeybaseClient, c *KeybaseDaemonRPC,
	uid keybase1.UID, expectedName kbname.NormalizedUsername,
	expectedCalled bool) {
	client.loadUserPlusKeysCalled = false

	ctx := context.Background()
	info, err := c.LoadUserPlusKeys(
		ctx, uid, "", keybase1.OfflineAvailability_NONE)
	require.NoError(t, err)

	assert.Equal(t, expectedName, info.Name)
	assert.Equal(t, expectedCalled, client.loadUserPlusKeysCalled)
}

func testIdentify(
	t *testing.T, client *fakeKeybaseClient, c *KeybaseDaemonRPC,
	uid keybase1.UID, expectedName kbname.NormalizedUsername,
	expectedCalled bool) {
	client.identifyCalled = false

	ctx := context.Background()
	name, _, err := c.Identify(
		ctx, "uid:"+string(uid), "", keybase1.OfflineAvailability_NONE)
	require.NoError(t, err)

	assert.Equal(t, expectedName, name)
	assert.Equal(t, expectedCalled, client.identifyCalled)
}

// Test that the user cache works and is invalidated as expected.
func TestKeybaseDaemonUserCache(t *testing.T) {
	uid1 := keybase1.MakeTestUID(1)
	uid2 := keybase1.MakeTestUID(2)
	name1 := kbname.NewNormalizedUsername("name1")
	name2 := kbname.NewNormalizedUsername("name2")
	users := map[keybase1.UID]idutil.UserInfo{
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

	// IdentifyLite doesn't fill the cache.
	testIdentify(t, client, c, uid2, name2, expectCall)

	// Shouldn't be cached yet after just an identify.
	testLoadUserPlusKeys(t, client, c, uid2, name2, expectCall)

	// Should be cached.
	testLoadUserPlusKeys(t, client, c, uid2, name2, expectCached)

	// Should not be cached.
	testIdentify(t, client, c, uid2, name2, expectCall)

	// Should invalidate cache for uid1.
	err := c.KeyfamilyChanged(context.Background(), uid1)
	require.NoError(t, err)

	// Should fill cache again.
	testLoadUserPlusKeys(t, client, c, uid1, name1, expectCall)

	// Should be cached again.
	testLoadUserPlusKeys(t, client, c, uid1, name1, expectCached)

	// Should invalidate cache for uid2.
	err = c.KeyfamilyChanged(context.Background(), uid2)
	require.NoError(t, err)

	// Should fill cache again.
	testLoadUserPlusKeys(t, client, c, uid2, name2, expectCall)

	// Should be cached again.
	testLoadUserPlusKeys(t, client, c, uid2, name2, expectCached)

	// Should invalidate cache for all users.
	c.OnDisconnected(context.Background(), rpc.UsingExistingConnection)

	// Should fill cache again.
	testLoadUserPlusKeys(t, client, c, uid1, name1, expectCall)
	testLoadUserPlusKeys(t, client, c, uid2, name2, expectCall)

	// Test that CheckForRekey gets called only if the logged-in user
	// changes.
	session := idutil.SessionInfo{
		UID: uid1,
	}
	c.setCachedCurrentSession(session)
	ctr := NewSafeTestReporter(t)
	mockCtrl := gomock.NewController(ctr)
	config := NewConfigMock(mockCtrl, ctr)
	c.config = config
	defer func() {
		config.ctr.CheckForFailures()
		mockCtrl.Finish()
	}()
	errChan := make(chan error, 1)
	config.mockMdserv.EXPECT().CheckForRekeys(gomock.Any()).Do(
		func(ctx context.Context) {
			errChan <- nil
		}).Return(errChan)
	err = c.KeyfamilyChanged(context.Background(), uid1)
	require.NoError(t, err)
	<-errChan
	// This one shouldn't trigger CheckForRekeys; if it does, the mock
	// controller will catch it during Finish.
	err = c.KeyfamilyChanged(context.Background(), uid2)
	require.NoError(t, err)
}

func TestKeybaseDaemonRPCEditList(t *testing.T) {
	var userName1, userName2 kbname.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(ctx, t, config1, cancel)
	// kbfsOpsConcurInit turns off notifications, so turn them back on.
	config1.SetMode(modeTest{NewInitModeFromType(InitDefault)})

	clock, first := clocktest.NewTestClockAndTimeNow()
	config1.SetClock(clock)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)

	name := userName1.String() + "," + userName2.String()

	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	// user 1 creates a file
	kbfsOps1 := config1.KBFSOps()
	_, _, err := kbfsOps1.CreateFile(
		ctx, rootNode1, testPPS("a"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	kbfsOps2 := config2.KBFSOps()
	err = kbfsOps2.SyncFromServer(ctx, rootNode2.GetFolderBranch(), nil)
	require.NoError(t, err)

	clock.Add(1 * time.Minute)
	second := clock.Now()

	_, _, err = kbfsOps2.CreateFile(ctx, rootNode2, testPPS("b"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	err = kbfsOps2.SyncFromServer(ctx, rootNode2.GetFolderBranch(), nil)
	require.NoError(t, err)
	err = kbfsOps1.SyncFromServer(ctx, rootNode1.GetFolderBranch(), nil)
	require.NoError(t, err)

	session1, err := config1.KBPKI().GetCurrentSession(context.Background())
	require.NoError(t, err)
	uid1 := session1.UID
	session2, err := config2.KBPKI().GetCurrentSession(context.Background())
	require.NoError(t, err)
	uid2 := session2.UID

	// We should see 1 create edit for each user.
	expectedHistory := keybase1.FSFolderEditHistory{
		Folder: keybase1.Folder{
			Name:       name,
			FolderType: keybase1.FolderType_PRIVATE,
			Private:    true,
		},
		ServerTime: keybase1.ToTime(second),
		History: []keybase1.FSFolderWriterEditHistory{
			{
				WriterName: "u2",
				Edits: []keybase1.FSFolderWriterEdit{{
					Filename:         "/keybase/private/u1,u2/b",
					NotificationType: keybase1.FSNotificationType_FILE_MODIFIED,
					ServerTime:       keybase1.ToTime(second),
				}},
				Deletes: []keybase1.FSFolderWriterEdit{},
			},
			{
				WriterName: "u1",
				Edits: []keybase1.FSFolderWriterEdit{{
					Filename:         "/keybase/private/u1,u2/a",
					NotificationType: keybase1.FSNotificationType_FILE_MODIFIED,
					ServerTime:       keybase1.ToTime(first),
				}},
				Deletes: []keybase1.FSFolderWriterEdit{},
			},
		},
	}

	users := map[keybase1.UID]idutil.UserInfo{
		uid1: {Name: userName1},
		uid2: {Name: userName2},
	}
	client1 := &fakeKeybaseClient{users: users}
	c1 := newKeybaseDaemonRPCWithClient(
		nil, client1, logger.NewTestLogger(t))
	c1.config = config1

	reqID := 10
	err = c1.FSEditListRequest(ctx, keybase1.FSEditListRequest{
		Folder:    keybase1.Folder{Name: name, Private: true},
		RequestID: reqID,
	})
	require.NoError(t, err)
	history := client1.editResponse.Edits
	require.Equal(t, expectedHistory, history)
}
