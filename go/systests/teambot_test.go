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

func checkNewTeambotKeyNotifications(tc *libkb.TestContext, notifications *teamNotifyHandler,
	expectedArgs []keybase1.NewTeambotKeyArg) {
	matches := map[keybase1.NewTeambotKeyArg]struct{}{}
	numFound := 0
	for {
		select {
		case arg := <-notifications.newTeambotKeyCh:
			for _, expectedArg := range expectedArgs {
				if expectedArg == arg {
					matches[arg] = struct{}{}
					break
				}
			}
			// make don't have any unexpected notifications
			if len(matches) <= numFound {
				require.Fail(tc.T, "unexpected newTeamKeyNeeded notification", arg)
			}
			if len(matches) == len(expectedArgs) {
				return
			}
			numFound++
		case <-time.After(5 * time.Second * libkb.CITimeMultiplier(tc.G)):
			require.Fail(tc.T, "no notification on newTeambotKey")
		}
	}
}

func checkTeambotKeyNeededNotifications(tc *libkb.TestContext, notifications *teamNotifyHandler,
	expectedArg keybase1.TeambotKeyNeededArg) {
	select {
	case arg := <-notifications.teambotKeyNeededCh:
		require.Equal(tc.T, expectedArg, arg)
		return
	case <-time.After(5 * time.Second * libkb.CITimeMultiplier(tc.G)):
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
	newKeyArgs := []keybase1.NewTeambotKeyArg{
		{
			Id:          teamID,
			Generation:  1,
			Application: keybase1.TeamApplication_CHAT,
		},
		{
			Id:          teamID,
			Generation:  1,
			Application: keybase1.TeamApplication_KVSTORE,
		},
	}
	checkNewTeambotKeyNotifications(botua.tc, botua.notifications, newKeyArgs)

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

	teambotKey2, err := botKeyer.GetLatestTeambotKey(mctx3, teamID, keybase1.TeamApplication_CHAT)
	require.NoError(t, err)
	require.Equal(t, teambotKey, teambotKey2)

	// delete the initial key to check regeneration flows
	err = teambot.DeleteTeambotKeyForTest(mctx3, teamID, keybase1.TeamApplication_CHAT,
		teambotKey.Metadata.Generation)

	require.NoError(t, err)

	// initial get, bot has no key to access
	_, err = botKeyer.GetLatestTeambotKey(mctx3, teamID, keybase1.TeamApplication_CHAT)
	require.IsType(t, teambot.TeambotTransientKeyError{}, err)

	// cry for help has been issued.
	keyNeededArg := keybase1.TeambotKeyNeededArg{
		Id:          teamID,
		Uid:         botua.uid,
		Generation:  1,
		Application: keybase1.TeamApplication_CHAT,
	}
	checkTeambotKeyNeededNotifications(user1.tc, user1.notifications, keyNeededArg)
	checkTeambotKeyNeededNotifications(user2.tc, user2.notifications, keyNeededArg)

	// and answered.
	newKeyArgs = []keybase1.NewTeambotKeyArg{{
		Id:          teamID,
		Generation:  1,
		Application: keybase1.TeamApplication_CHAT,
	}}
	checkNewTeambotKeyNotifications(botua.tc, botua.notifications, newKeyArgs)

	// bot can access the key
	teambotKey2, err = botKeyer.GetLatestTeambotKey(mctx3, teamID, keybase1.TeamApplication_CHAT)
	require.NoError(t, err)
	require.Equal(t, teambotKey, teambotKey2)
	noTeambotKeyNeeded(user1.tc, user1.notifications)
	noTeambotKeyNeeded(user2.tc, user2.notifications)
	noNewTeambotKeyNotification(botua.tc, botua.notifications)

	// check for wrong application
	_, err = botKeyer.GetLatestTeambotKey(mctx3, teamID, keybase1.TeamApplication_KBFS)
	require.IsType(t, teambot.TeambotTransientKeyError{}, err)

	// cry for help has been issued.
	keyNeededArg = keybase1.TeambotKeyNeededArg{
		Id:          teamID,
		Uid:         botua.uid,
		Generation:  1,
		Application: keybase1.TeamApplication_KBFS,
	}
	checkTeambotKeyNeededNotifications(user1.tc, user1.notifications, keyNeededArg)
	checkTeambotKeyNeededNotifications(user2.tc, user2.notifications, keyNeededArg)

	// and answered.
	newKeyArgs = []keybase1.NewTeambotKeyArg{{
		Id:          teamID,
		Generation:  1,
		Application: keybase1.TeamApplication_KBFS,
	}}
	checkNewTeambotKeyNotifications(botua.tc, botua.notifications, newKeyArgs)

	_, err = botKeyer.GetLatestTeambotKey(mctx3, teamID, keybase1.TeamApplication_KBFS)
	require.NoError(t, err)
	noTeambotKeyNeeded(user1.tc, user1.notifications)
	noTeambotKeyNeeded(user2.tc, user2.notifications)
	noNewTeambotKeyNotification(botua.tc, botua.notifications)

	// Test the AtGeneration flow
	teambotKey2b, err := botKeyer.GetTeambotKeyAtGeneration(mctx3, teamID,
		keybase1.TeamApplication_CHAT, teambotKey2.Metadata.Generation)
	require.NoError(t, err)
	require.Equal(t, teambotKey2, teambotKey2b)
	noTeambotKeyNeeded(user1.tc, user1.notifications)
	noTeambotKeyNeeded(user2.tc, user2.notifications)
	noNewTeambotKeyNotification(botua.tc, botua.notifications)

	// force a PTK rotation
	user2.revokePaperKey()
	user1.waitForRotateByID(teamID, keybase1.Seqno(4))

	// bot gets a new key on rotation
	newKeyArgs = []keybase1.NewTeambotKeyArg{
		{
			Id:          teamID,
			Generation:  2,
			Application: keybase1.TeamApplication_CHAT,
		},
		{
			Id:          teamID,
			Generation:  2,
			Application: keybase1.TeamApplication_KVSTORE,
		},
	}
	checkNewTeambotKeyNotifications(botua.tc, botua.notifications, newKeyArgs)

	// delete to check regeneration flow
	err = teambot.DeleteTeambotKeyForTest(mctx3, teamID, keybase1.TeamApplication_CHAT, 2)
	require.NoError(t, err)

	// Force a wrongKID error on the bot user by expiring the wrongKID cache
	key := teambot.TeambotKeyWrongKIDCacheKey(teamID, botua.uid, teambotKey2.Metadata.Generation,
		keybase1.TeamApplication_CHAT)
	expired := keybase1.ToTime(fc.Now())
	err = mctx3.G().GetKVStore().PutObj(key, nil, expired)
	require.NoError(t, err)
	permitted, ctime, err := teambot.TeambotKeyWrongKIDPermitted(mctx3, teamID, botua.uid,
		keybase1.TeamApplication_CHAT, teambotKey2.Metadata.Generation, keybase1.ToTime(fc.Now()))
	require.NoError(t, err)
	require.True(t, permitted)
	require.Equal(t, expired, ctime)

	fc.Advance(teambot.MaxTeambotKeyWrongKIDPermitted) // expire wrong KID cache
	permitted, ctime, err = teambot.TeambotKeyWrongKIDPermitted(mctx3, teamID, botua.uid,
		keybase1.TeamApplication_CHAT, teambotKey2.Metadata.Generation, keybase1.ToTime(fc.Now()))
	require.NoError(t, err)
	require.False(t, permitted)
	require.Equal(t, expired, ctime)

	_, err = botKeyer.GetLatestTeambotKey(mctx3, teamID, keybase1.TeamApplication_CHAT)
	require.IsType(t, teambot.TeambotPermanentKeyError{}, err)
	require.False(t, created)
	keyNeededArg = keybase1.TeambotKeyNeededArg{
		Id:          teamID,
		Uid:         botua.uid,
		Generation:  teambotKey2.Metadata.Generation + 1,
		Application: keybase1.TeamApplication_CHAT,
	}
	checkTeambotKeyNeededNotifications(user1.tc, user1.notifications, keyNeededArg)
	checkTeambotKeyNeededNotifications(user2.tc, user2.notifications, keyNeededArg)
	newKeyArgs = []keybase1.NewTeambotKeyArg{{
		Id:          teamID,
		Generation:  teambotKey2.Metadata.Generation + 1,
		Application: keybase1.TeamApplication_CHAT,
	}}
	checkNewTeambotKeyNotifications(botua.tc, botua.notifications, newKeyArgs)

	teambotKey3, err := botKeyer.GetLatestTeambotKey(mctx3, teamID, keybase1.TeamApplication_CHAT)
	require.NoError(t, err)
	require.Equal(t, teambotKey3.Metadata.Generation, teambotKey2.Metadata.Generation+1)
	require.Equal(t, keybase1.TeamApplication_CHAT, teambotKey3.Metadata.Application)

	// another PTK rotation happens, this time the bot can proceed with a key
	// signed by the old PTK since the wrongKID cache did not expire
	user1.removeTeamMember(teamName.String(), user2.username)
	user1.addTeamMember(teamName.String(), user2.username, keybase1.TeamRole_WRITER)
	user2.waitForNewlyAddedToTeamByID(teamID)
	botua.waitForNewlyAddedToTeamByID(teamID)

	newKeyArgs = []keybase1.NewTeambotKeyArg{
		{
			Id:          teamID,
			Generation:  3,
			Application: keybase1.TeamApplication_CHAT,
		},
		{
			Id:          teamID,
			Generation:  3,
			Application: keybase1.TeamApplication_KVSTORE,
		},
	}
	checkNewTeambotKeyNotifications(botua.tc, botua.notifications, newKeyArgs)

	err = teambot.DeleteTeambotKeyForTest(mctx3, teamID, keybase1.TeamApplication_CHAT, 3)
	require.NoError(t, err)

	// bot can access the old teambotKey, but asks for a new one to
	// be created since it was signed by the old PTK
	teambotKey4, err := botKeyer.GetLatestTeambotKey(mctx3, teamID, keybase1.TeamApplication_CHAT)
	require.NoError(t, err)
	require.Equal(t, teambotKey3, teambotKey4)
	keyNeededArg = keybase1.TeambotKeyNeededArg{
		Id:          teamID,
		Uid:         botua.uid,
		Generation:  teambotKey4.Metadata.Generation + 1,
		Application: keybase1.TeamApplication_CHAT,
	}
	checkTeambotKeyNeededNotifications(user1.tc, user1.notifications, keyNeededArg)
	checkTeambotKeyNeededNotifications(user2.tc, user2.notifications, keyNeededArg)

	newKeyArgs = []keybase1.NewTeambotKeyArg{{
		Id:          teamID,
		Generation:  teambotKey4.Metadata.Generation + 1,
		Application: keybase1.TeamApplication_CHAT,
	}}
	checkNewTeambotKeyNotifications(botua.tc, botua.notifications, newKeyArgs)

	team, err = teams.Load(mctx1.Ctx(), mctx1.G(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	appKey2, err := team.ApplicationKey(mctx1.Ctx(), keybase1.TeamApplication_CHAT)
	require.NoError(t, err)
	teambotKey, _, err = memberKeyer1.GetOrCreateTeambotKey(mctx1, teamID, botuaUID, appKey2)
	require.NoError(t, err)
	require.Equal(t, appKey1.Generation()+2, teambotKey.Generation())

	teambotKey2, err = botKeyer.GetLatestTeambotKey(mctx3, teamID, keybase1.TeamApplication_CHAT)
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
	require.Equal(t, keybase1.TeamApplication_CHAT, teambotKey.Metadata.Application)

	// Make sure we can access the teambotKey at various generations
	for i := keybase1.TeambotKeyGeneration(1); i < teambotKey.Metadata.Generation; i++ {
		teambotKeyBot, err := botKeyer.GetTeambotKeyAtGeneration(mctx3, teamID, keybase1.TeamApplication_CHAT, i)
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
	_, err = botKeyer.GetTeambotKeyAtGeneration(mctx3, teamID, keybase1.TeamApplication_CHAT, badGen)
	require.IsType(t, teambot.TeambotTransientKeyError{}, err)
	keyNeededArg = keybase1.TeambotKeyNeededArg{
		Id:          teamID,
		Uid:         botua.uid,
		Generation:  badGen,
		Application: keybase1.TeamApplication_CHAT,
	}
	checkTeambotKeyNeededNotifications(user1.tc, user1.notifications, keyNeededArg)
	checkTeambotKeyNeededNotifications(user2.tc, user2.notifications, keyNeededArg)
	noNewTeambotKeyNotification(botua.tc, botua.notifications)
}

func TestTeambotKeyRemovedMember(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	user1 := tt.addUser("one")
	botua := tt.addUser("botua")
	botuaUID := gregor1.UID(botua.uid.ToBytes())
	mctx1 := libkb.NewMetaContextForTest(*user1.tc)
	ekLib1 := mctx1.G().GetEKLib()
	memberKeyer1 := mctx1.G().GetTeambotMemberKeyer()

	teamID, teamName := user1.createTeam2()
	user1.addRestrictedBotTeamMember(teamName.String(), botua.username, keybase1.TeamBotSettings{})
	newKeyArgs := []keybase1.NewTeambotKeyArg{
		{
			Id:          teamID,
			Generation:  1,
			Application: keybase1.TeamApplication_CHAT,
		},
		{
			Id:          teamID,
			Generation:  1,
			Application: keybase1.TeamApplication_KVSTORE,
		},
	}
	checkNewTeambotKeyNotifications(botua.tc, botua.notifications, newKeyArgs)
	user1.removeTeamMember(teamName.String(), botua.username)

	team, err := teams.Load(mctx1.Ctx(), mctx1.G(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	appKey, err := team.ChatKey(mctx1.Ctx())
	require.NoError(t, err)

	_, created, err := memberKeyer1.GetOrCreateTeambotKey(mctx1, teamID, botuaUID, appKey)
	require.False(t, created)
	require.NoError(t, err)
	noNewTeambotKeyNotification(botua.tc, botua.notifications)

	err = ekLib1.KeygenIfNeeded(mctx1)
	require.NoError(t, err)
	_, created, err = ekLib1.GetOrCreateLatestTeambotEK(mctx1, teamID, botuaUID)
	require.False(t, created)
	require.NoError(t, err)
	noNewTeambotEKNotification(botua.tc, botua.notifications)
}
