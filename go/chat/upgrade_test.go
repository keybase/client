package chat

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func makeTLFID() chat1.TLFID {
	suffix := byte(0x29)
	idBytes, err := libkb.RandBytesWithSuffix(16, suffix)
	if err != nil {
		panic("RandBytes failed: " + err.Error())
	}
	return chat1.TLFID(idBytes)
}

func TestChatKBFSUpgradeMixed(t *testing.T) {
	ctc := makeChatTestContext(t, "TestChatKBFSUpgradeMixed", 1)
	defer ctc.cleanup()
	u := ctc.users()[0]

	tc := ctc.world.Tcs[u.Username]
	uid := u.User.GetUID().ToBytes()
	tlf := kbtest.NewTlfMock(ctc.world)
	ctx := newTestContextWithTlfMock(tc, tlf)
	ri := ctc.as(t, u).ri

	info := mustCreateConversationForTest(t, ctc, u, chat1.TopicType_CHAT, chat1.ConversationMembersType_KBFS)
	cres, err := tlf.CryptKeys(ctx, u.Username)
	require.NoError(t, err)
	tlfID := cres.NameIDBreaks.TlfID
	t.Logf("TLFID: %s", tlfID)
	require.Equal(t, info.Triple.Tlfid, chat1.TLFID(tlfID.ToBytes()))
	conv, err := utils.GetVerifiedConv(context.TODO(), tc.Context(), uid, info.Id,
		types.InboxSourceDataSourceAll)
	require.NoError(t, err)

	header := chat1.MessageClientHeader{
		TlfPublic:   false,
		TlfName:     u.Username,
		MessageType: chat1.MessageType_TEXT,
	}
	kbfsPlain := textMsgWithHeader(t, "kbfs", header)

	boxer := NewBoxer(tc.Context())
	sender := NewBlockingSender(tc.Context(), boxer, func() chat1.RemoteInterface { return ri })
	prepareRes, err := sender.Prepare(ctx, kbfsPlain, chat1.ConversationMembersType_KBFS, &conv, nil)
	require.NoError(t, err)
	kbfsBoxed := prepareRes.Boxed
	kbfsBoxed.ServerHeader = &chat1.MessageServerHeader{
		Ctime:     gregor1.ToTime(time.Now()),
		MessageID: 2,
	}

	require.NoError(t, teams.UpgradeTLFIDToImpteam(ctx, tc.G, u.Username, tlfID, false,
		keybase1.TeamApplication_CHAT, cres.CryptKeys))

	conv.Info.MembersType = chat1.ConversationMembersType_IMPTEAMUPGRADE
	ctx = globals.CtxAddOverrideNameInfoSource(ctx, nil)
	header = chat1.MessageClientHeader{
		TlfPublic:   false,
		TlfName:     u.Username,
		MessageType: chat1.MessageType_TEXT,
	}
	teamPlain := textMsgWithHeader(t, "team", header)
	prepareRes, err = sender.Prepare(ctx, teamPlain,
		chat1.ConversationMembersType_IMPTEAMUPGRADE, &conv, nil)
	require.NoError(t, err)
	teamBoxed := prepareRes.Boxed
	teamBoxed.ServerHeader = &chat1.MessageServerHeader{
		Ctime:     gregor1.ToTime(time.Now()),
		MessageID: 3,
	}

	checkUnbox := func() {
		unboxed, err := boxer.UnboxMessages(ctx, []chat1.MessageBoxed{teamBoxed, kbfsBoxed}, conv)
		require.NoError(t, err)
		require.Len(t, unboxed, 2)
		for _, u := range unboxed {
			require.True(t, u.IsValid())
			require.NotNil(t, u.Valid().ClientHeader.KbfsCryptKeysUsed)
			if u.GetMessageID() == kbfsBoxed.GetMessageID() {
				require.True(t, *u.Valid().ClientHeader.KbfsCryptKeysUsed)
				require.Equal(t, "kbfs", u.Valid().MessageBody.Text().Body)
			} else {
				require.False(t, *u.Valid().ClientHeader.KbfsCryptKeysUsed)
				require.Equal(t, "team", u.Valid().MessageBody.Text().Body)
			}
		}
	}
	checkUnbox()

	// Associate a new TLF ID with the team and make sure we can still use the chat
	rogueTLFID := keybase1.TLFID(makeTLFID().String())
	t.Logf("rogue: %s", rogueTLFID)
	iteam, _, _, err := teams.LookupOrCreateImplicitTeam(context.TODO(), tc.G, u.Username, false)
	t.Logf("TEAMID: %s", iteam.ID)
	require.NoError(t, err)
	require.NoError(t, iteam.AssociateWithTLFID(context.TODO(), rogueTLFID))
	tlfIDToTeamID.storage.Purge()
	iteam, err = teams.Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		ID:              iteam.ID,
		ForceFullReload: true,
	})
	require.NoError(t, err)
	require.Equal(t, 2, len(iteam.KBFSTLFIDs()))
	globals.CtxKeyFinder(ctx, tc.Context()).Reset()
	checkUnbox()
}

func TestChatKBFSUpgradeBadteam(t *testing.T) {
	ctc := makeChatTestContext(t, "TestLoadTeamImpteamUpgradeSafety", 2)
	defer ctc.cleanup()
	users := ctc.users()

	tc0 := ctc.world.Tcs[users[0].Username]
	tc1 := ctc.world.Tcs[users[1].Username]
	useRemoteMock = true
	conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_KBFS)
	delete(ctc.userContextCache, users[0].Username)
	useRemoteMock = false
	listener0 := newServerChatListener()
	ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)

	iteam, _, _, err := teams.LookupOrCreateImplicitTeam(context.TODO(), tc1.Context().ExternalG(),
		users[0].Username+","+users[1].Username, false)
	require.NoError(t, err)

	tlfID := keybase1.TLFID(conv.Triple.Tlfid.String())
	require.NoError(t, iteam.AssociateWithTLFID(context.TODO(), tlfID))
	team, err := teams.Load(context.TODO(), tc1.Context().ExternalG(), keybase1.LoadTeamArg{
		ID:          iteam.ID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	require.NoError(t, team.AssociateWithTLFKeyset(context.TODO(), tlfID, []keybase1.CryptKey{
		keybase1.CryptKey{},
	}, keybase1.TeamApplication_CHAT))

	// Should fail because the name of the imp team doesn't match the conversation name
	loader := NewTeamLoader(tc0.Context().ExternalG())
	_, err = loader.loadTeam(context.TODO(), chat1.TLFID(tlfID.ToBytes()), conv.TlfName,
		chat1.ConversationMembersType_IMPTEAMUPGRADE, false, nil)
	require.Error(t, err)
	require.IsType(t, ImpteamBadteamError{}, err)
}
