package systests

import (
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teambot"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

func TestTeambotNewTeambotKeyNotif(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	user1 := tt.addUser("one")
	botua := tt.addUser("botua")
	botuaUID := gregor1.UID(botua.uid.ToBytes())
	mctx := libkb.NewMetaContextForTest(*user1.tc)

	teamID, teamName := user1.createTeam2()
	user1.addRestrictedBotTeamMember(teamName.String(), botua.username, keybase1.TeamBotSettings{})

	teambot.ServiceInit(mctx)
	memberKeyer := user1.tc.G.GetTeambotMemberKeyer()

	team, err := teams.Load(mctx.Ctx(), mctx.G(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	appKey, err := team.ApplicationKey(mctx.Ctx(), keybase1.TeamApplication_CHAT)
	require.NoError(t, err)

	teambotKey, created, err := memberKeyer.GetOrCreateTeambotKey(mctx, teamID, botuaUID, appKey)
	require.NoError(t, err)
	require.True(t, created)
	require.Equal(t, teambotKey.Generation(), appKey.Generation())

	expectedArg := keybase1.NewTeambotKeyArg{
		Id:         teamID,
		Generation: teambotKey.Metadata.Generation,
	}
	checkNewTeambotKeyNotifications(botua.tc, botua.notifications, expectedArg)
}

func checkNewTeambotKeyNotifications(tc *libkb.TestContext, notifications *teamNotifyHandler,
	expectedArg keybase1.NewTeambotKeyArg) {
	select {
	case arg := <-notifications.newTeambotKeyCh:
		require.Equal(tc.T, expectedArg, arg)
		return
	case <-time.After(500 * time.Millisecond * libkb.CITimeMultiplier(tc.G)):
		require.Fail(tc.T, "no notification on newTeambotKey")
	}
}

func checkTeambotKeyNeededNotifications(tc *libkb.TestContext, notifications *teamNotifyHandler,
	expectedArg keybase1.TeambotKeyNeededArg) {
	select {
	case arg := <-notifications.teambotKeyNeededCh:
		require.Equal(tc.T, expectedArg, arg)
		return
	case <-time.After(500 * time.Millisecond * libkb.CITimeMultiplier(tc.G)):
		require.Fail(tc.T, "no notification on teambotKeyNeeded")
	}
}

func noNewTeambotKeyNotification(tc *libkb.TestContext, notifications *teamNotifyHandler) {
	select {
	case arg := <-notifications.newTeambotKeyCh:
		require.Fail(tc.T, "unexpected newTeambotKey notification", arg)
	default:
	}
}

func noTeambotKeyNeeded(tc *libkb.TestContext, notifications *teamNotifyHandler) {
	select {
	case arg := <-notifications.teambotKeyNeededCh:
		require.Fail(tc.T, "unexpected teambotKeyNeeded notification", arg)
	default:
	}
}

func TestTeambotKey(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	fc := clockwork.NewFakeClockAt(time.Now())

	user1 := tt.addUser("one")
	user2 := tt.addUserWithPaper("two")
	botua := tt.addUser("botua")
	botuaUID := gregor1.UID(botua.uid.ToBytes())
	mctx1 := libkb.NewMetaContextForTest(*user1.tc)
	mctx2 := libkb.NewMetaContextForTest(*user2.tc)
	mctx3 := libkb.NewMetaContextForTest(*botua.tc)
	memberKeyer1 := mctx1.G().GetTeambotMemberKeyer()
	memberKeyer2 := mctx2.G().GetTeambotMemberKeyer()
	botKeyer := mctx3.G().GetTeambotBotKeyer().(*teambot.BotKeyer)
	botKeyer.SetClock(fc)

	teamID, teamName := user1.createTeam2()
	user1.addTeamMember(teamName.String(), user2.username, keybase1.TeamRole_WRITER)
	user1.addRestrictedBotTeamMember(teamName.String(), botua.username, keybase1.TeamBotSettings{})

	// bot gets a key on addition to the team
	newKeyArg := keybase1.NewTeambotKeyArg{
		Id:         teamID,
		Generation: 1,
	}
	checkNewTeambotKeyNotifications(botua.tc, botua.notifications, newKeyArg)

	// grab the latest chat application key and make sure the generation lines
	// up with the teambotKey
	team, err := teams.Load(mctx1.Ctx(), mctx1.G(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	appKey1, err := team.ChatKey(mctx1.Ctx())
	require.NoError(t, err)

	// now created = false since we published on member addition
	teambotKey, created, err := memberKeyer1.GetOrCreateTeambotKey(mctx1, teamID, botuaUID, appKey1)
	require.NoError(t, err)
	require.False(t, created)
	require.Equal(t, appKey1.Generation(), teambotKey.Generation())

	teambotKey2, err := botKeyer.GetLatestTeambotKey(mctx3, teamID)
	require.NoError(t, err)
	require.Equal(t, teambotKey, teambotKey2)

	// delete the initial key to check regeneration flows
	err = teambot.DeleteTeambotKeyForTest(mctx3, teamID, teambotKey.Metadata.Generation)
	require.NoError(t, err)

	// initial get, bot has no key to access
	_, err = botKeyer.GetLatestTeambotKey(mctx3, teamID)
	require.Error(t, err)
	require.IsType(t, teambot.TeambotTransientKeyError{}, err)

	// cry for help has been issued.
	keyNeededArg := keybase1.TeambotKeyNeededArg{
		Id:         teamID,
		Uid:        botua.uid,
		Generation: 1,
	}
	checkTeambotKeyNeededNotifications(user1.tc, user1.notifications, keyNeededArg)
	checkTeambotKeyNeededNotifications(user2.tc, user2.notifications, keyNeededArg)

	// and answered.
	newKeyArg = keybase1.NewTeambotKeyArg{
		Id:         teamID,
		Generation: 1,
	}
	checkNewTeambotKeyNotifications(botua.tc, botua.notifications, newKeyArg)

	// bot can access the key
	teambotKey2, err = botKeyer.GetLatestTeambotKey(mctx3, teamID)
	require.NoError(t, err)
	require.Equal(t, teambotKey, teambotKey2)
	noTeambotKeyNeeded(user1.tc, user1.notifications)
	noTeambotKeyNeeded(user2.tc, user2.notifications)
	noNewTeambotKeyNotification(botua.tc, botua.notifications)

	// Test the AtGeneration flow
	teambotKey2b, err := botKeyer.GetTeambotKeyAtGeneration(mctx3, teamID, teambotKey2.Metadata.Generation)
	require.NoError(t, err)
	require.Equal(t, teambotKey2, teambotKey2b)
	noTeambotKeyNeeded(user1.tc, user1.notifications)
	noTeambotKeyNeeded(user2.tc, user2.notifications)
	noNewTeambotKeyNotification(botua.tc, botua.notifications)

	// force a PTK rotation
	user2.revokePaperKey()
	user1.waitForRotateByID(teamID, keybase1.Seqno(4))

	// bot gets a new key on rotation
	newKeyArg = keybase1.NewTeambotKeyArg{
		Id:         teamID,
		Generation: 2,
	}
	checkNewTeambotKeyNotifications(botua.tc, botua.notifications, newKeyArg)

	// delete to check regeneration flow
	err = teambot.DeleteTeambotKeyForTest(mctx3, teamID, 2)
	require.NoError(t, err)

	// Force a wrongKID error on the bot user by expiring the wrongKID cache
	key := teambot.TeambotKeyWrongKIDCacheKey(teamID, botua.uid, teambotKey2.Metadata.Generation)
	expired := keybase1.ToTime(fc.Now())
	mctx3.G().GetKVStore().PutObj(key, nil, expired)
	permitted, ctime, err := teambot.TeambotKeyWrongKIDPermitted(mctx3, teamID, botua.uid,
		teambotKey2.Metadata.Generation, keybase1.ToTime(fc.Now()))
	require.NoError(t, err)
	require.True(t, permitted)
	require.Equal(t, expired, ctime)

	fc.Advance(teambot.MaxTeambotKeyWrongKIDPermitted) // expire wrong KID cache
	permitted, ctime, err = teambot.TeambotKeyWrongKIDPermitted(mctx3, teamID, botua.uid,
		teambotKey2.Metadata.Generation, keybase1.ToTime(fc.Now()))
	require.NoError(t, err)
	require.False(t, permitted)
	require.Equal(t, expired, ctime)

	_, err = botKeyer.GetLatestTeambotKey(mctx3, teamID)
	require.Error(t, err)
	require.IsType(t, teambot.TeambotPermanentKeyError{}, err)
	require.False(t, created)
	keyNeededArg = keybase1.TeambotKeyNeededArg{
		Id:         teamID,
		Uid:        botua.uid,
		Generation: teambotKey2.Metadata.Generation + 1,
	}
	checkTeambotKeyNeededNotifications(user1.tc, user1.notifications, keyNeededArg)
	checkTeambotKeyNeededNotifications(user2.tc, user2.notifications, keyNeededArg)
	newKeyArg = keybase1.NewTeambotKeyArg{
		Id:         teamID,
		Generation: teambotKey2.Metadata.Generation + 1,
	}
	checkNewTeambotKeyNotifications(botua.tc, botua.notifications, newKeyArg)

	teambotKey3, err := botKeyer.GetLatestTeambotKey(mctx3, teamID)
	require.NoError(t, err)
	require.Equal(t, teambotKey3.Metadata.Generation, teambotKey2.Metadata.Generation+1)

	// another PTK rotation happens, this time the bot can proceed with a key
	// signed by the old PTK since the wrongKID cache did not expire
	user1.removeTeamMember(teamName.String(), user2.username)
	user1.addTeamMember(teamName.String(), user2.username, keybase1.TeamRole_WRITER)
	user2.waitForNewlyAddedToTeamByID(teamID)
	botua.waitForNewlyAddedToTeamByID(teamID)

	newKeyArg = keybase1.NewTeambotKeyArg{
		Id:         teamID,
		Generation: 3,
	}
	checkNewTeambotKeyNotifications(botua.tc, botua.notifications, newKeyArg)

	err = teambot.DeleteTeambotKeyForTest(mctx3, teamID, 3)
	require.NoError(t, err)

	// bot can access the old teambotKey, but asks for a new one to
	// be created since it was signed by the old PTK
	teambotKey4, err := botKeyer.GetLatestTeambotKey(mctx3, teamID)
	require.NoError(t, err)
	require.Equal(t, teambotKey3, teambotKey4)
	keyNeededArg = keybase1.TeambotKeyNeededArg{
		Id:         teamID,
		Uid:        botua.uid,
		Generation: teambotKey4.Metadata.Generation + 1,
	}
	checkTeambotKeyNeededNotifications(user1.tc, user1.notifications, keyNeededArg)
	checkTeambotKeyNeededNotifications(user2.tc, user2.notifications, keyNeededArg)

	newKeyArg = keybase1.NewTeambotKeyArg{
		Id:         teamID,
		Generation: teambotKey4.Metadata.Generation + 1,
	}
	checkNewTeambotKeyNotifications(botua.tc, botua.notifications, newKeyArg)

	team, err = teams.Load(mctx1.Ctx(), mctx1.G(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	appKey2, err := team.ApplicationKey(mctx1.Ctx(), keybase1.TeamApplication_CHAT)
	require.NoError(t, err)
	teambotKey, _, err = memberKeyer1.GetOrCreateTeambotKey(mctx1, teamID, botuaUID, appKey2)
	require.NoError(t, err)
	require.Equal(t, appKey1.Generation()+2, teambotKey.Generation())

	teambotKey2, err = botKeyer.GetLatestTeambotKey(mctx3, teamID)
	require.NoError(t, err)
	require.Equal(t, teambotKey, teambotKey2)
	noTeambotKeyNeeded(user1.tc, user1.notifications)
	noTeambotKeyNeeded(user2.tc, user2.notifications)
	noNewTeambotKeyNotification(botua.tc, botua.notifications)

	// kill the cache and make sure we don't republish
	memberKeyer1.PurgeCache(mctx1)
	teambotKeyNoCache, created, err := memberKeyer1.GetOrCreateTeambotKey(mctx1, teamID, botuaUID, appKey2)
	require.NoError(t, err)
	// created is True since we attempt to publish but the generation remains
	require.True(t, created)
	require.Equal(t, teambotKey.Metadata.Generation, teambotKeyNoCache.Metadata.Generation)

	// Make sure we can access the teambotKey at various generations
	for i := keybase1.TeambotKeyGeneration(1); i < teambotKey.Metadata.Generation; i++ {
		teambotKeyBot, err := botKeyer.GetTeambotKeyAtGeneration(mctx3, teamID, i)
		require.NoError(t, err)
		noTeambotKeyNeeded(user1.tc, user1.notifications)
		noTeambotKeyNeeded(user2.tc, user2.notifications)
		noNewTeambotKeyNotification(botua.tc, botua.notifications)

		appKey, err := team.ApplicationKeyAtGeneration(mctx1.Ctx(), keybase1.TeamApplication_CHAT, keybase1.PerTeamKeyGeneration(i))
		require.NoError(t, err)

		teambotKeyNonBot1, _, err := memberKeyer1.GetOrCreateTeambotKey(mctx1, teamID, botuaUID, appKey)
		require.NoError(t, err)
		require.Equal(t, teambotKeyBot, teambotKeyNonBot1)

		teambotKeyNonBot2, _, err := memberKeyer2.GetOrCreateTeambotKey(mctx2, teamID, botuaUID, appKey)
		require.NoError(t, err)
		require.Equal(t, teambotKeyBot, teambotKeyNonBot2)
	}

	// bot asks for a non-existent generation, no new key is created.
	badGen := teambotKey.Metadata.Generation + 50
	_, err = botKeyer.GetTeambotKeyAtGeneration(mctx3, teamID, badGen)
	require.Error(t, err)
	require.IsType(t, teambot.TeambotTransientKeyError{}, err)
	keyNeededArg = keybase1.TeambotKeyNeededArg{
		Id:         teamID,
		Uid:        botua.uid,
		Generation: badGen,
	}
	checkTeambotKeyNeededNotifications(user1.tc, user1.notifications, keyNeededArg)
	checkTeambotKeyNeededNotifications(user2.tc, user2.notifications, keyNeededArg)
	noNewTeambotKeyNotification(botua.tc, botua.notifications)
}
