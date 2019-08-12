package systests

import (
	"testing"
	"time"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/ephemeral"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teambot"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

func TestEphemeralNewTeamEKNotif(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	user1 := tt.addUser("one")
	user2 := tt.addUser("wtr")
	mctx := libkb.NewMetaContextForTest(*user1.tc)

	teamID, teamName := user1.createTeam2()
	user1.addTeamMember(teamName.String(), user2.username, keybase1.TeamRole_WRITER)

	ephemeral.ServiceInit(mctx)
	ekLib := user1.tc.G.GetEKLib()

	teamEK, created, err := ekLib.GetOrCreateLatestTeamEK(mctx, teamID)
	require.NoError(t, err)
	require.True(t, created)

	expectedArg := keybase1.NewTeamEkArg{
		Id:         teamID,
		Generation: teamEK.Generation(),
	}

	checkNewTeamEKNotifications(user1.tc, user1.notifications, expectedArg)
	checkNewTeamEKNotifications(user2.tc, user2.notifications, expectedArg)
}

func checkNewTeamEKNotifications(tc *libkb.TestContext, notifications *teamNotifyHandler, expectedArg keybase1.NewTeamEkArg) {
	select {
	case arg := <-notifications.newTeamEKCh:
		require.Equal(tc.T, expectedArg, arg)
		return
	case <-time.After(500 * time.Millisecond * libkb.CITimeMultiplier(tc.G)):
		require.Fail(tc.T, "no notification on newTeamEK")
	}
}

func TestEphemeralNewTeambotEKNotif(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	user1 := tt.addUser("one")
	botua := tt.addUser("botua")
	botuaUID := gregor1.UID(botua.uid.ToBytes())
	mctx := libkb.NewMetaContextForTest(*user1.tc)

	teamID, teamName := user1.createTeam2()
	user1.addRestrictedBotTeamMember(teamName.String(), botua.username, keybase1.TeamBotSettings{})

	ephemeral.ServiceInit(mctx)
	ekLib := user1.tc.G.GetEKLib()

	teambotEK, created, err := ekLib.GetOrCreateLatestTeambotEK(mctx, teamID, botuaUID)
	require.NoError(t, err)
	require.True(t, created)

	expectedArg := keybase1.NewTeambotEkArg{
		Id:         teamID,
		Generation: teambotEK.Generation(),
	}

	checkNewTeambotEKNotifications(botua.tc, botua.notifications, expectedArg)
}

func checkNewTeambotEKNotifications(tc *libkb.TestContext, notifications *teamNotifyHandler, expectedArg keybase1.NewTeambotEkArg) {
	select {
	case arg := <-notifications.newTeambotEKCh:
		require.Equal(tc.T, expectedArg, arg)
		return
	case <-time.After(500 * time.Millisecond * libkb.CITimeMultiplier(tc.G)):
		require.Fail(tc.T, "no notification on newTeambotEK")
	}
}

func checkTeambotEKNeededNotifications(tc *libkb.TestContext, notifications *teamNotifyHandler, expectedArg keybase1.TeambotEkNeededArg) {
	select {
	case arg := <-notifications.teambotEKNeededCh:
		require.Equal(tc.T, expectedArg, arg)
		return
	case <-time.After(500 * time.Millisecond * libkb.CITimeMultiplier(tc.G)):
		require.Fail(tc.T, "no notification on teambotEKNeeded")
	}
}

func noNewTeambotEKNotification(tc *libkb.TestContext, notifications *teamNotifyHandler) {
	select {
	case arg := <-notifications.newTeambotEKCh:
		require.Fail(tc.T, "unexpected newTeambotEK notification", arg)
	default:
	}
}

func noTeambotEKNeeded(tc *libkb.TestContext, notifications *teamNotifyHandler) {
	select {
	case arg := <-notifications.teambotEKNeededCh:
		require.Fail(tc.T, "unexpected teambotEKNeeded notification", arg)
	default:
	}
}

func TestEphemeralTeambotEK(t *testing.T) {
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
	ekLib1 := mctx1.G().GetEKLib()
	ekLib2 := mctx2.G().GetEKLib()
	ekLib3 := mctx3.G().GetEKLib().(*ephemeral.EKLib)
	ekLib3.SetClock(fc)

	teamID, teamName := user1.createTeam2()
	user1.addTeamMember(teamName.String(), user2.username, keybase1.TeamRole_WRITER)
	user1.addRestrictedBotTeamMember(teamName.String(), botua.username, keybase1.TeamBotSettings{})

	// bot gets a key on addition to the team
	newEkArg := keybase1.NewTeambotEkArg{
		Id:         teamID,
		Generation: 1,
	}
	checkNewTeambotEKNotifications(botua.tc, botua.notifications, newEkArg)

	// grab the latest teamEK and make sure the generation lines up with the teambotEK
	teamEK, _, err := ekLib1.GetOrCreateLatestTeamEK(mctx1, teamID)
	require.NoError(t, err)

	// now created = false since we published on member addition
	teambotEK, created, err := ekLib1.GetOrCreateLatestTeambotEK(mctx1, teamID, botuaUID)
	require.NoError(t, err)
	require.False(t, created)
	require.Equal(t, teamEK.Generation(), teambotEK.Generation())

	teambotEK2, _, err := ekLib3.GetOrCreateLatestTeambotEK(mctx3, teamID, botuaUID)
	require.NoError(t, err)
	require.Equal(t, teambotEK2.Generation(), teambotEK.Generation())
	require.Equal(t, teambotEK2.Material(), teambotEK.Material())
	noTeambotEKNeeded(user1.tc, user1.notifications)
	noTeambotEKNeeded(user2.tc, user2.notifications)
	noNewTeambotEKNotification(botua.tc, botua.notifications)

	// delete the initial key to check regeneration flows
	err = teambot.DeleteTeambotEKForTest(mctx3, teamID, 1)
	require.NoError(t, err)

	// initial get, bot has no key to access
	_, created, err = ekLib3.GetOrCreateLatestTeambotEK(mctx3, teamID, botuaUID)
	require.Error(t, err)
	require.IsType(t, ephemeral.EphemeralKeyError{}, err)
	require.False(t, created)

	// cry for help has been issued.
	ekNeededArg := keybase1.TeambotEkNeededArg{
		Id:         teamID,
		Uid:        botua.uid,
		Generation: 0,
	}
	checkTeambotEKNeededNotifications(user1.tc, user1.notifications, ekNeededArg)
	checkTeambotEKNeededNotifications(user2.tc, user2.notifications, ekNeededArg)

	// and answered.
	newEkArg = keybase1.NewTeambotEkArg{
		Id:         teamID,
		Generation: 1,
	}
	checkNewTeambotEKNotifications(botua.tc, botua.notifications, newEkArg)

	// bot can access the key
	teambotEK2, created, err = ekLib3.GetOrCreateLatestTeambotEK(mctx3, teamID, botuaUID)
	require.NoError(t, err)
	require.False(t, created)
	require.Equal(t, teambotEK, teambotEK2)
	noTeambotEKNeeded(user1.tc, user1.notifications)
	noTeambotEKNeeded(user2.tc, user2.notifications)
	noNewTeambotEKNotification(botua.tc, botua.notifications)

	// force a PTK rotation
	user2.revokePaperKey()
	user1.waitForRotateByID(teamID, keybase1.Seqno(4))

	// bot gets a new EK on rotation
	newEkArg = keybase1.NewTeambotEkArg{
		Id:         teamID,
		Generation: 2,
	}
	checkNewTeambotEKNotifications(botua.tc, botua.notifications, newEkArg)

	// delete to check regeneration flow
	err = teambot.DeleteTeambotEKForTest(mctx3, teamID, 2)
	require.NoError(t, err)

	// Force a wrongKID error on the bot user by expiring the wrongKID cache
	key := teambot.TeambotEKWrongKIDCacheKey(teamID, botua.uid, teambotEK2.Generation())
	expired := keybase1.ToTime(fc.Now())
	mctx3.G().GetKVStore().PutObj(key, nil, expired)
	permitted, ctime, err := teambot.TeambotEKWrongKIDPermitted(mctx3, teamID, botua.uid,
		teambotEK2.Generation(), keybase1.ToTime(fc.Now()))
	require.NoError(t, err)
	require.True(t, permitted)
	require.Equal(t, expired, ctime)

	fc.Advance(teambot.MaxTeambotKeyWrongKIDPermitted) // expire wrong KID cache
	permitted, ctime, err = teambot.TeambotEKWrongKIDPermitted(mctx3, teamID, botua.uid,
		teambotEK2.Generation(), keybase1.ToTime(fc.Now()))
	require.NoError(t, err)
	require.False(t, permitted)
	require.Equal(t, expired, ctime)

	fc.Advance(ephemeral.LibCacheEntryLifetime) // expire lib ek caches
	_, created, err = ekLib3.GetOrCreateLatestTeambotEK(mctx3, teamID, botuaUID)
	require.Error(t, err)
	require.IsType(t, ephemeral.EphemeralKeyError{}, err)
	require.False(t, created)
	ekNeededArg = keybase1.TeambotEkNeededArg{
		Id:         teamID,
		Uid:        botua.uid,
		Generation: 0,
	}
	checkTeambotEKNeededNotifications(user1.tc, user1.notifications, ekNeededArg)
	checkTeambotEKNeededNotifications(user2.tc, user2.notifications, ekNeededArg)
	newEkArg = keybase1.NewTeambotEkArg{
		Id:         teamID,
		Generation: teambotEK2.Generation() + 1,
	}
	checkNewTeambotEKNotifications(botua.tc, botua.notifications, newEkArg)

	teambotEK3, created, err := ekLib3.GetOrCreateLatestTeambotEK(mctx3, teamID, botuaUID)
	require.NoError(t, err)
	require.False(t, created)
	noTeambotEKNeeded(user1.tc, user1.notifications)
	noTeambotEKNeeded(user2.tc, user2.notifications)
	noNewTeambotEKNotification(botua.tc, botua.notifications)

	// another PTK rotation happens, this time the bot proceeded with a key
	// signed by the old PTK since the wrongKID cache did not expire
	user1.removeTeamMember(teamName.String(), user2.username)
	user1.addTeamMember(teamName.String(), user2.username, keybase1.TeamRole_WRITER)
	user2.waitForNewlyAddedToTeamByID(teamID)
	botua.waitForNewlyAddedToTeamByID(teamID)

	// bot gets a new EK on rotation
	newEkArg = keybase1.NewTeambotEkArg{
		Id:         teamID,
		Generation: 3,
	}
	checkNewTeambotEKNotifications(botua.tc, botua.notifications, newEkArg)

	// delete to check regeneration flow
	err = teambot.DeleteTeambotEKForTest(mctx3, teamID, 3)
	require.NoError(t, err)

	// bot can access the old teambotEK, but asks for a new one to
	// be created since it was signed by the old PTK
	fc.Advance(ephemeral.LibCacheEntryLifetime) // expire lib ek caches
	teambotEK4, created, err := ekLib3.GetOrCreateLatestTeambotEK(mctx3, teamID, botuaUID)
	require.NoError(t, err)
	require.False(t, created)
	require.Equal(t, teambotEK3, teambotEK4)
	ekNeededArg = keybase1.TeambotEkNeededArg{
		Id:         teamID,
		Uid:        botua.uid,
		Generation: 0,
	}
	checkTeambotEKNeededNotifications(user1.tc, user1.notifications, ekNeededArg)
	checkTeambotEKNeededNotifications(user2.tc, user2.notifications, ekNeededArg)

	newEkArg = keybase1.NewTeambotEkArg{
		Id:         teamID,
		Generation: teambotEK4.Generation() + 1,
	}
	checkNewTeambotEKNotifications(botua.tc, botua.notifications, newEkArg)

	teambotEK, created, err = ekLib1.GetOrCreateLatestTeambotEK(mctx1, teamID, botuaUID)
	require.NoError(t, err)
	require.False(t, created)
	require.Equal(t, teamEK.Generation()+2, teambotEK.Generation())

	teambotEK2, created, err = ekLib3.GetOrCreateLatestTeambotEK(mctx3, teamID, botuaUID)
	require.NoError(t, err)
	require.False(t, created)
	require.Equal(t, teambotEK, teambotEK2)
	noTeambotEKNeeded(user1.tc, user1.notifications)
	noTeambotEKNeeded(user2.tc, user2.notifications)
	noNewTeambotEKNotification(botua.tc, botua.notifications)

	// kill the ek cache and make sure we don't republish
	ekLib1.ClearCaches(mctx1)
	teambotEKNoCache, created, err := ekLib1.GetOrCreateLatestTeambotEK(mctx1, teamID, botuaUID)
	require.NoError(t, err)
	// created is True since we attempt to publish but the generation remains
	require.True(t, created)
	require.Equal(t, teambotEK.Generation(), teambotEKNoCache.Generation())

	// Make sure we can access the teambotEK at various generations
	for i := keybase1.EkGeneration(1); i < teambotEK.Generation(); i++ {
		teambotEKBot, err := ekLib3.GetTeambotEK(mctx3, teamID, botuaUID, i, nil)
		require.NoError(t, err)
		noTeambotEKNeeded(user1.tc, user1.notifications)
		noTeambotEKNeeded(user2.tc, user2.notifications)
		noNewTeambotEKNotification(botua.tc, botua.notifications)

		teambotEKNonBot1, err := ekLib1.GetTeambotEK(mctx1, teamID, botuaUID, i, nil)
		require.NoError(t, err)
		require.Equal(t, teambotEKBot.Generation(), teambotEKNonBot1.Generation())
		require.Equal(t, teambotEKBot.Material(), teambotEKNonBot1.Material())

		teambotEKNonBot2, err := ekLib2.GetTeambotEK(mctx2, teamID, botuaUID, i, nil)
		require.NoError(t, err)
		require.Equal(t, teambotEKBot.Generation(), teambotEKNonBot2.Generation())
		require.Equal(t, teambotEKBot.Material(), teambotEKNonBot2.Material())
	}

	// bot asks for a non-existent generation, no new key is created.
	badGen := teambotEK.Generation() + 50
	_, err = ekLib3.GetTeambotEK(mctx3, teamID, botuaUID, badGen, nil)
	require.Error(t, err)
	require.IsType(t, ephemeral.EphemeralKeyError{}, err)
	ekNeededArg = keybase1.TeambotEkNeededArg{
		Id:         teamID,
		Uid:        botua.uid,
		Generation: badGen,
	}
	checkTeambotEKNeededNotifications(user1.tc, user1.notifications, ekNeededArg)
	checkTeambotEKNeededNotifications(user2.tc, user2.notifications, ekNeededArg)
	noNewTeambotEKNotification(botua.tc, botua.notifications)
}

func TestEphemeralAddMemberWithTeamEK(t *testing.T) {
	runAddMember(t, true /* createTeamEK*/)
}

func TestEphemeralAddMemberNoTeamEK(t *testing.T) {
	runAddMember(t, false /* createTeamEK*/)
}

func getTeamEK(mctx libkb.MetaContext, teamID keybase1.TeamID, generation keybase1.EkGeneration) (keybase1.TeamEk, error) {
	ek, err := mctx.G().GetTeamEKBoxStorage().Get(mctx, teamID, generation, nil)
	if err != nil {
		return keybase1.TeamEk{}, err
	}

	typ, err := ek.KeyType()
	if err != nil {
		return keybase1.TeamEk{}, err
	}
	if !typ.IsTeam() {
		return keybase1.TeamEk{}, ephemeral.NewIncorrectTeamEphemeralKeyTypeError(typ, keybase1.TeamEphemeralKeyType_TEAM)
	}
	return ek.Team(), nil
}

func runAddMember(t *testing.T, createTeamEK bool) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := ctx.installKeybaseForUser("ann", 10)
	ann.signup()
	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()

	annMctx := ann.MetaContext()
	ephemeral.ServiceInit(annMctx)
	bobMctx := bob.MetaContext()
	ephemeral.ServiceInit(bobMctx)

	team := ann.createTeam([]*smuUser{})
	teamName, err := keybase1.TeamNameFromString(team.name)
	require.NoError(t, err)
	teamID := teamName.ToPrivateTeamID()

	var expectedMetadata keybase1.TeamEkMetadata
	var expectedGeneration keybase1.EkGeneration
	if createTeamEK {
		ekLib := annMctx.G().GetEKLib()
		ek, created, err := ekLib.GetOrCreateLatestTeamEK(annMctx, teamID)
		require.NoError(t, err)
		require.True(t, created)
		typ, err := ek.KeyType()
		require.NoError(t, err)
		require.True(t, typ.IsTeam())
		teamEK := ek.Team()

		expectedMetadata = teamEK.Metadata
		expectedGeneration = expectedMetadata.Generation
	} else {
		expectedMetadata = keybase1.TeamEkMetadata{}
		expectedGeneration = 1
	}

	ann.addWriter(team, bob)

	annTeamEK, annErr := getTeamEK(annMctx, teamID, expectedGeneration)
	bobTeamEK, bobErr := getTeamEK(bobMctx, teamID, expectedGeneration)
	if createTeamEK {
		require.NoError(t, annErr)
		require.NoError(t, bobErr)
	} else {
		require.Error(t, annErr)
		require.IsType(t, ephemeral.EphemeralKeyError{}, annErr)
		ekErr := annErr.(ephemeral.EphemeralKeyError)
		require.Equal(t, ephemeral.DefaultHumanErrMsg, ekErr.HumanError())

		require.Error(t, bobErr)
		require.IsType(t, ephemeral.EphemeralKeyError{}, bobErr)
		ekErr = bobErr.(ephemeral.EphemeralKeyError)
		require.Equal(t, ephemeral.DefaultHumanErrMsg, ekErr.HumanError())
	}
	require.Equal(t, bobTeamEK.Metadata, expectedMetadata)
	require.Equal(t, annTeamEK.Metadata, expectedMetadata)
}

func TestEphemeralResetMember(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := ctx.installKeybaseForUser("ann", 10)
	ann.signup()
	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()
	joe := ctx.installKeybaseForUser("joe", 10)
	joe.signup()

	annMctx := ann.MetaContext()
	ephemeral.ServiceInit(annMctx)
	bobMctx := bob.MetaContext()
	ephemeral.ServiceInit(bobMctx)
	joeMctx := joe.MetaContext()
	ephemeral.ServiceInit(joeMctx)

	team := ann.createTeam([]*smuUser{bob})
	teamName, err := keybase1.TeamNameFromString(team.name)
	require.NoError(t, err)
	teamID := teamName.ToPrivateTeamID()

	// Reset bob, invaliding any userEK he has.
	bob.reset()

	annEkLib := annMctx.G().GetEKLib()
	ek, created, err := annEkLib.GetOrCreateLatestTeamEK(annMctx, teamID)
	require.NoError(t, err)
	require.True(t, created)

	typ, err := ek.KeyType()
	require.NoError(t, err)
	require.True(t, typ.IsTeam())
	teamEK := ek.Team()

	expectedMetadata := teamEK.Metadata
	expectedGeneration := expectedMetadata.Generation

	annTeamEK, annErr := getTeamEK(annMctx, teamID, expectedGeneration)
	require.NoError(t, annErr)
	require.Equal(t, annTeamEK.Metadata, expectedMetadata)

	// Bob should not have access to this teamEK since he's no longer in the
	// team after resetting.
	bob.loginAfterReset(10)
	bobMctx = bob.MetaContext()
	bobTeamEK, bobErr := getTeamEK(bobMctx, teamID, expectedGeneration)
	require.Error(t, bobErr)
	require.IsType(t, libkb.AppStatusError{}, bobErr)
	appStatusErr := bobErr.(libkb.AppStatusError)
	require.Equal(t, appStatusErr.Code, libkb.SCNotFound)

	// Also add joe who has a valid userEK
	ann.addWriter(team, bob)
	ann.addWriter(team, joe)

	// ann gets the new teamEk which joe can access but bob cannot after he reset.
	ek2, created, err := annEkLib.GetOrCreateLatestTeamEK(annMctx, teamID)
	require.NoError(t, err)
	require.False(t, created)
	typ, err = ek.KeyType()
	require.NoError(t, err)
	require.True(t, typ.IsTeam())
	teamEK2 := ek2.Team()

	expectedMetadata2 := teamEK2.Metadata
	expectedGeneration2 := expectedMetadata2.Generation
	// We can't require that the next generation is exactly 1 greater than the
	// previous, because there's a race where a CLKR sneaks in here.
	require.True(t, expectedGeneration < expectedGeneration2)

	annTeamEK, annErr = getTeamEK(annMctx, teamID, expectedGeneration2)
	require.NoError(t, annErr)
	require.Equal(t, annTeamEK.Metadata, expectedMetadata2)

	bobTeamEK, bobErr = getTeamEK(bobMctx, teamID, expectedGeneration2)
	require.NoError(t, bobErr)
	require.Equal(t, bobTeamEK.Metadata, expectedMetadata2)

	joeTeamEk, joeErr := getTeamEK(joeMctx, teamID, expectedGeneration2)
	require.NoError(t, joeErr)
	require.Equal(t, joeTeamEk.Metadata, expectedMetadata2)
}

func TestEphemeralRotateWithTeamEK(t *testing.T) {
	runRotate(t, true /* createTeamEK*/)
}

func TestEphemeralRotateNoTeamEK(t *testing.T) {
	runRotate(t, false /* createTeamEK*/)
}

func runRotate(t *testing.T, createTeamEK bool) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	bob := tt.addUserWithPaper("bob")

	annMctx := ann.MetaContext()
	ephemeral.ServiceInit(annMctx)
	bobMctx := bob.MetaContext()
	ephemeral.ServiceInit(bobMctx)

	teamID, teamName := ann.createTeam2()

	// After rotate, we should have rolled the teamEK if one existed.
	var expectedGeneration keybase1.EkGeneration
	if createTeamEK {
		ekLib := annMctx.G().GetEKLib()
		teamEK, created, err := ekLib.GetOrCreateLatestTeamEK(annMctx, teamID)
		require.NoError(t, err)
		require.True(t, created)
		expectedGeneration = teamEK.Generation() + 1
	} else {
		expectedGeneration = 1
	}

	ann.addTeamMember(teamName.String(), bob.username, keybase1.TeamRole_WRITER)

	bob.revokePaperKey()
	ann.waitForRotateByID(teamID, keybase1.Seqno(3))

	storage := annMctx.G().GetTeamEKBoxStorage()
	teamEK, err := storage.Get(annMctx, teamID, expectedGeneration, nil)
	if createTeamEK {
		require.NoError(t, err)
	} else {
		require.Error(t, err)
		require.IsType(t, ephemeral.EphemeralKeyError{}, err)
		ekErr := err.(ephemeral.EphemeralKeyError)
		require.Equal(t, ephemeral.DefaultHumanErrMsg, ekErr.HumanError())
		require.Equal(t, keybase1.TeamEphemeralKey{}, teamEK)
	}
}

func TestEphemeralRotateSkipTeamEKRoll(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	bob := tt.addUserWithPaper("bob")

	annMctx := ann.MetaContext()
	ephemeral.ServiceInit(annMctx)
	bobMctx := bob.MetaContext()
	ephemeral.ServiceInit(bobMctx)

	teamID, teamName := ann.createTeam2()

	// Get our ephemeral keys before the revoke and ensure we can still access
	// them after.
	ekLib := annMctx.G().GetEKLib()
	teamEKPreRoll, created, err := ekLib.GetOrCreateLatestTeamEK(annMctx, teamID)
	require.NoError(t, err)
	require.True(t, created)

	// This is a hack to skip the teamEK generation during the PTK roll.
	// We want to validate that we can create a new teamEK after this roll even
	// though our existing teamEK is signed by a (now) invalid PTK
	annMctx.G().SetEKLib(nil)

	ann.addTeamMember(teamName.String(), bob.username, keybase1.TeamRole_WRITER)

	bob.revokePaperKey()
	ann.waitForRotateByID(teamID, keybase1.Seqno(3))
	annMctx.G().SetEKLib(ekLib)

	// Ensure that we access the old teamEK even though it was signed by a
	// non-latest PTK
	teamEKBoxStorage := annMctx.G().GetTeamEKBoxStorage()
	teamEKBoxStorage.ClearCache()
	_, err = annMctx.G().LocalDb.Nuke() // Force us to refetch and verify the key from the server
	require.NoError(t, err)
	teamEKPostRoll, err := teamEKBoxStorage.Get(annMctx, teamID, teamEKPreRoll.Generation(), nil)
	require.NoError(t, err)
	require.Equal(t, teamEKPreRoll, teamEKPostRoll)

	// After rotating, ensure we can create a new TeamEK without issue.
	needed, err := ekLib.NewTeamEKNeeded(annMctx, teamID)
	require.NoError(t, err)
	require.True(t, needed)

	merkleRoot, err := annMctx.G().GetMerkleClient().FetchRootFromServer(libkb.NewMetaContextForTest(*ann.tc), libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	metadata, err := ephemeral.ForcePublishNewTeamEKForTesting(annMctx, teamID, *merkleRoot)
	require.NoError(t, err)
	require.Equal(t, teamEKPreRoll.Generation()+1, metadata.Generation)
}

func TestEphemeralNewUserEKAndTeamEKAfterRevokes(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUserWithPaper("ann")

	teamID, _ := ann.createTeam2()

	annMctx := ann.MetaContext()
	ephemeral.ServiceInit(annMctx)
	ekLib := annMctx.G().GetEKLib()

	_, created, err := ekLib.GetOrCreateLatestTeamEK(annMctx, teamID)
	require.NoError(t, err)
	require.True(t, created)
	userEKBoxStorage := annMctx.G().GetUserEKBoxStorage()
	gen, err := userEKBoxStorage.MaxGeneration(annMctx, false)
	require.NoError(t, err)
	userEKPreRevoke, err := userEKBoxStorage.Get(annMctx, gen, nil)
	require.NoError(t, err)

	// Provision a new device that we can revoke.
	newDevice := ann.provisionNewDevice()

	// Revoke it.
	revokeEngine := engine.NewRevokeDeviceEngine(annMctx.G(), engine.RevokeDeviceEngineArgs{
		ID:        newDevice.deviceKey.DeviceID,
		ForceSelf: true,
		ForceLast: false,
		// We don't need a UserEK here since we force generate it below
		SkipUserEKForTesting: true,
	})
	uis := libkb.UIs{
		LogUI:    annMctx.G().Log,
		SecretUI: ann.newSecretUI(),
	}
	m := libkb.NewMetaContextForTest(*ann.tc).WithUIs(uis)
	err = engine.RunEngine2(m, revokeEngine)
	require.NoError(t, err)

	// Ensure that we access the old userEKs even though it was signed by a
	// non-latest PUK
	userEKBoxStorage.ClearCache()
	_, err = annMctx.G().LocalDb.Nuke() // Force us to refetch and verify the key from the server
	require.NoError(t, err)
	userEKPostRevoke, err := userEKBoxStorage.Get(annMctx, userEKPreRevoke.Metadata.Generation, nil)
	require.NoError(t, err)
	require.Equal(t, userEKPreRevoke, userEKPostRevoke)

	// Now provision a new userEK. This makes sure that we don't get confused
	// by the revoked device's deviceEKs.
	merkleRoot, err := annMctx.G().GetMerkleClient().FetchRootFromServer(annMctx, libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	_, err = ephemeral.ForcePublishNewUserEKForTesting(annMctx, *merkleRoot)
	require.NoError(t, err)

	// And do the same for the teamEK, just to be sure.
	_, err = ephemeral.ForcePublishNewTeamEKForTesting(annMctx, teamID, *merkleRoot)
	require.NoError(t, err)
}

func readdToTeamWithEKs(t *testing.T, leave bool) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	// Make standalone user that will not run gregor. This is
	// important in the *leave* case, where we want to observe
	// effects of team key and EK not being rotated.
	user1 := makeUserStandalone(t, "user1", standaloneUserArgs{
		disableGregor:            true,
		suppressTeamChatAnnounce: true,
	})
	user2 := tt.addUser("wtr")

	teamID, teamName := user1.createTeam2()
	user1.addTeamMember(teamName.String(), user2.username, keybase1.TeamRole_WRITER)
	user2.waitForNewlyAddedToTeamByID(teamID)

	mctx1 := user1.MetaContext()
	ephemeral.ServiceInit(mctx1)
	ekLib := mctx1.G().GetEKLib()
	teamEK, created, err := ekLib.GetOrCreateLatestTeamEK(mctx1, teamID)
	require.NoError(t, err)
	require.True(t, created)

	currentGen := teamEK.Generation()
	var expectedGen keybase1.EkGeneration
	if leave {
		user2.leave(teamName.String())
		expectedGen = currentGen // user left, no one to rotate keys.
	} else {
		user1.removeTeamMember(teamName.String(), user2.username)
		expectedGen = currentGen + 1 // admin removes user, rotates TK and EK
	}

	// After leaving user2 won't have access to the current teamEK
	_, err = user2.tc.G.GetTeamEKBoxStorage().Get(user2.MetaContext(), teamID, currentGen, nil)
	require.Error(t, err)
	require.IsType(t, libkb.AppStatusError{}, err)
	appStatusErr := err.(libkb.AppStatusError)
	require.Equal(t, appStatusErr.Code, libkb.SCNotFound)

	user1.addTeamMember(teamName.String(), user2.username, keybase1.TeamRole_WRITER)
	user2.waitForNewlyAddedToTeamByID(teamID)

	// Test that user1 and user2 both have access to the currentTeamEK
	// (whether we recreated or reboxed)
	teamEK2U1, err := user1.tc.G.GetTeamEKBoxStorage().Get(mctx1, teamID, expectedGen, nil)
	require.NoError(t, err)

	teamEK2U2, err := user2.tc.G.GetTeamEKBoxStorage().Get(user2.MetaContext(), teamID, expectedGen, nil)
	require.NoError(t, err)

	require.Equal(t, teamEK2U1, teamEK2U2)
}

func TestEphemeralTeamMemberLeaveAndReadd(t *testing.T) {
	readdToTeamWithEKs(t, true /* leave */)
}

func TestEphemeralTeamMemberRemoveAndReadd(t *testing.T) {
	readdToTeamWithEKs(t, false /* leave */)
}

func TestEphemeralAfterEKError(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	user1 := makeUserStandalone(t, "user1", standaloneUserArgs{
		disableGregor:            true,
		suppressTeamChatAnnounce: true,
	})
	teamID, teamName := user1.createTeam2()
	g1 := user1.tc.G
	mctx1 := user1.MetaContext()
	ephemeral.ServiceInit(mctx1)
	merkleRoot, err := g1.GetMerkleClient().FetchRootFromServer(mctx1, libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	// Force two team EKs to be created and then create/add u2 to the team.
	// They should not be able to access the first key since they were added
	// after (they are reboxed for the second as part of the add
	teamEKMetadata1, err := ephemeral.ForcePublishNewTeamEKForTesting(mctx1, teamID, *merkleRoot)
	require.NoError(t, err)
	teamEKMetadata2, err := ephemeral.ForcePublishNewTeamEKForTesting(mctx1, teamID, *merkleRoot)
	require.NoError(t, err)

	user2 := tt.addUserWithPaper("u2")
	user1.addTeamMember(teamName.String(), user2.username, keybase1.TeamRole_WRITER)
	user2.waitForNewlyAddedToTeamByID(teamID)

	mctx2 := libkb.NewMetaContextForTest(*user2.tc)
	_, err = mctx2.G().GetTeamEKBoxStorage().Get(mctx2, teamID, teamEKMetadata1.Generation, nil)
	require.Error(t, err)
	require.IsType(t, ephemeral.EphemeralKeyError{}, err)
	ekErr := err.(ephemeral.EphemeralKeyError)
	require.Equal(t, libkb.SCEphemeralMemberAfterEK, ekErr.StatusCode)

	ek2, err := mctx2.G().GetTeamEKBoxStorage().Get(mctx2, teamID, teamEKMetadata2.Generation, nil)
	require.NoError(t, err)
	typ, err := ek2.KeyType()
	require.NoError(t, err)
	require.True(t, typ.IsTeam())
	teamEK2 := ek2.Team()
	require.Equal(t, teamEKMetadata2, teamEK2.Metadata)

	// Force a second userEK so when the new device is provisioned it is only
	// reboxed for the second userEK. Try to access the first userEK and fail.
	userEKMetdata, err := ephemeral.ForcePublishNewUserEKForTesting(mctx2, *merkleRoot)
	require.NoError(t, err)
	newDevice := user2.provisionNewDevice()
	mctx2 = libkb.NewMetaContextForTest(*newDevice.tctx)

	_, err = mctx2.G().GetUserEKBoxStorage().Get(mctx2, userEKMetdata.Generation-1, nil)
	require.Error(t, err)
	require.IsType(t, ephemeral.EphemeralKeyError{}, err)
	ekErr = err.(ephemeral.EphemeralKeyError)
	require.Equal(t, libkb.SCEphemeralDeviceAfterEK, ekErr.StatusCode)
}
