// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"reflect"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
)

type keybaseServiceSelfOwner struct {
	service KeybaseService
}

func (o keybaseServiceSelfOwner) KeybaseService() KeybaseService {
	return o.service
}

func makeTestKBPKIClient(t *testing.T) (
	client *KBPKIClient, currentUID keybase1.UID, users []idutil.LocalUser,
	teams []idutil.TeamInfo,
) {
	currentUID = keybase1.MakeTestUID(1)
	names := []kbname.NormalizedUsername{"test_name1", "test_name2"}
	users = idutil.MakeLocalUsers(names)
	teamNames := []kbname.NormalizedUsername{"test_team1", "test_team2"}
	teams = idutil.MakeLocalTeams(teamNames)
	codec := kbfscodec.NewMsgpack()
	daemon := NewKeybaseDaemonMemory(currentUID, users, teams, codec)
	return NewKBPKIClient(keybaseServiceSelfOwner{daemon},
		logger.NewTestLogger(t)), currentUID, users, teams
}

func makeTestKBPKIClientWithRevokedKey(t *testing.T, revokeTime time.Time) (
	client *KBPKIClient, currentUID keybase1.UID, users []idutil.LocalUser,
) {
	currentUID = keybase1.MakeTestUID(1)
	names := []kbname.NormalizedUsername{"test_name1", "test_name2"}
	users = idutil.MakeLocalUsers(names)
	// Give each user a revoked key
	for i, user := range users {
		index := 99
		keySalt := keySaltForUserDevice(user.Name, index)
		newVerifyingKey := idutil.MakeLocalUserVerifyingKeyOrBust(keySalt)
		user.RevokedVerifyingKeys = map[kbfscrypto.VerifyingKey]idutil.RevokedKeyInfo{
			newVerifyingKey: {Time: keybase1.ToTime(revokeTime)},
		}
		users[i] = user
	}
	codec := kbfscodec.NewMsgpack()
	daemon := NewKeybaseDaemonMemory(currentUID, users, nil, codec)
	return NewKBPKIClient(keybaseServiceSelfOwner{daemon},
		logger.NewTestLogger(t)), currentUID, users
}

func TestKBPKIClientIdentify(t *testing.T) {
	c, _, _, _ := makeTestKBPKIClient(t)

	_, id, err := c.Identify(
		context.Background(), "test_name1", "",
		keybase1.OfflineAvailability_NONE)
	require.NoError(t, err)
	require.NotEqual(t, keybase1.UserOrTeamID(""), id, "empty user")
}

func TestKBPKIClientGetNormalizedUsername(t *testing.T) {
	c, _, _, _ := makeTestKBPKIClient(t)

	name, err := c.GetNormalizedUsername(
		context.Background(), keybase1.MakeTestUID(1).AsUserOrTeam(),
		keybase1.OfflineAvailability_NONE)
	require.NoError(t, err)
	require.NotEqual(t, kbname.NormalizedUsername(""), name, "empty user")
}

func TestKBPKIClientHasVerifyingKey(t *testing.T) {
	c, _, localUsers, _ := makeTestKBPKIClient(t)

	err := c.HasVerifyingKey(
		context.Background(), keybase1.MakeTestUID(1),
		localUsers[0].VerifyingKeys[0], time.Now(),
		keybase1.OfflineAvailability_NONE)
	require.NoError(t, err, err)

	err = c.HasVerifyingKey(
		context.Background(), keybase1.MakeTestUID(1),
		kbfscrypto.VerifyingKey{}, time.Now(),
		keybase1.OfflineAvailability_NONE)
	require.NotNil(t, err, "HasVerifyingKey unexpectedly succeeded")
}

func TestKBPKIClientHasRevokedVerifyingKey(t *testing.T) {
	revokeTime := time.Now()
	c, _, localUsers := makeTestKBPKIClientWithRevokedKey(t, revokeTime)

	var revokedKey kbfscrypto.VerifyingKey
	for k := range localUsers[0].RevokedVerifyingKeys {
		revokedKey = k
		break
	}

	// Something verified before the key was revoked
	err := c.HasVerifyingKey(
		context.Background(), keybase1.MakeTestUID(1),
		revokedKey, revokeTime.Add(-10*time.Second),
		keybase1.OfflineAvailability_NONE)
	_, ok := errors.Cause(err).(RevokedDeviceVerificationError)
	require.True(t, ok, err)

	// Something verified after the key was revoked
	err = c.HasVerifyingKey(
		context.Background(), keybase1.MakeTestUID(1), revokedKey,
		revokeTime.Add(70*time.Second), keybase1.OfflineAvailability_NONE)
	require.NotNil(t, err, "HasVerifyingKey unexpectedly succeeded")
}

// Test that KBPKI forces a cache flush one time if it can't find a
// given verifying key.
func TestKBPKIClientHasVerifyingKeyStaleCache(t *testing.T) {
	ctr := NewSafeTestReporter(t)
	mockCtrl := gomock.NewController(ctr)
	config := NewConfigMock(mockCtrl, ctr)
	c := NewKBPKIClient(config, config.MakeLogger(""))
	config.SetKBPKI(c)
	defer func() {
		config.ctr.CheckForFailures()
		mockCtrl.Finish()
	}()

	u := keybase1.MakeTestUID(1)
	key1 := idutil.MakeLocalUserVerifyingKeyOrBust("u_1")
	key2 := idutil.MakeLocalUserVerifyingKeyOrBust("u_2")
	info1 := idutil.UserInfo{
		VerifyingKeys: []kbfscrypto.VerifyingKey{key1},
	}
	config.mockKbs.EXPECT().LoadUserPlusKeys(
		gomock.Any(), u, gomock.Any(), gomock.Any()).Return(info1, nil)

	config.mockKbs.EXPECT().FlushUserFromLocalCache(gomock.Any(), u)
	info2 := idutil.UserInfo{
		VerifyingKeys: []kbfscrypto.VerifyingKey{key1, key2},
	}
	config.mockKbs.EXPECT().LoadUserPlusKeys(
		gomock.Any(), u, key2.KID(), gomock.Any()).
		Return(info2, nil)

	err := c.HasVerifyingKey(
		context.Background(), u, key2, time.Now(),
		keybase1.OfflineAvailability_NONE)
	require.NoError(t, err, err)
}

func TestKBPKIClientGetCryptPublicKeys(t *testing.T) {
	c, _, localUsers, _ := makeTestKBPKIClient(t)

	cryptPublicKeys, err := c.GetCryptPublicKeys(
		context.Background(), keybase1.MakeTestUID(1),
		keybase1.OfflineAvailability_NONE)
	require.NoError(t, err)

	require.Len(t, cryptPublicKeys, 1,
		"Expected 1 crypt public key, got %d", len(cryptPublicKeys))

	key := cryptPublicKeys[0]
	expectedKey := localUsers[0].CryptPublicKeys[0]
	require.Equal(t, expectedKey, key, "Expected %s, got %s", expectedKey, key)
}

func TestKBPKIClientGetCurrentCryptPublicKey(t *testing.T) {
	c, _, localUsers, _ := makeTestKBPKIClient(t)

	session, err := c.GetCurrentSession(context.Background())
	require.NoError(t, err)

	kid := session.CryptPublicKey.KID()
	expectedKID := localUsers[0].GetCurrentCryptPublicKey().KID()
	require.Equal(t, expectedKID, kid, "Expected %s, got %s", expectedKID, kid)
}

func TestKBPKIClientGetTeamTLFCryptKeys(t *testing.T) {
	c, _, _, localTeams := makeTestKBPKIClient(t)

	require.False(t, len(localTeams) == 0, "No local teams were generated")

	for _, team := range localTeams {
		keys, keyGen, err := c.GetTeamTLFCryptKeys(
			context.Background(), team.TID, kbfsmd.UnspecifiedKeyGen,
			keybase1.OfflineAvailability_NONE)
		require.NoError(t, err, err)
		if !reflect.DeepEqual(team.CryptKeys, keys) {
			require.Failf(t, "", "Team TLF crypt keys don't match: %v vs %v", team.CryptKeys, keys)
		}
		require.Equal(t, kbfsmd.FirstValidKeyGen, keyGen, "Unexpected team key gen: %v", keyGen)
	}
}
