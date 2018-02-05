package chat

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

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
	require.Equal(t, info.Triple.Tlfid, chat1.TLFID(tlfID.ToBytes()))
	conv, _, err := GetUnverifiedConv(context.TODO(), tc.Context(), uid, info.Id, true)
	require.NoError(t, err)

	header := chat1.MessageClientHeader{
		TlfPublic:   false,
		TlfName:     u.Username,
		MessageType: chat1.MessageType_TEXT,
	}
	kbfsPlain := textMsgWithHeader(t, "kbfs", header)

	boxer := NewBoxer(tc.Context())
	sender := NewBlockingSender(tc.Context(), boxer, nil, func() chat1.RemoteInterface { return ri })
	kbfsBoxed, _, _, _, _, err := sender.Prepare(ctx, kbfsPlain, chat1.ConversationMembersType_KBFS, &conv)
	require.NoError(t, err)
	require.NotNil(t, kbfsBoxed)
	kbfsBoxed.ServerHeader = &chat1.MessageServerHeader{
		Ctime:     gregor1.ToTime(time.Now()),
		MessageID: 2,
	}

	require.NoError(t, teams.UpgradeTLFIDToImpteam(ctx, tc.G, u.Username, tlfID, false,
		keybase1.TeamApplication_CHAT, cres.CryptKeys))

	header = chat1.MessageClientHeader{
		TlfPublic:   false,
		TlfName:     u.Username,
		MessageType: chat1.MessageType_TEXT,
	}
	teamPlain := textMsgWithHeader(t, "team", header)
	teamBoxed, _, _, _, _, err := sender.Prepare(ctx, teamPlain,
		chat1.ConversationMembersType_IMPTEAMUPGRADE, &conv)
	require.NoError(t, err)
	require.NotNil(t, teamBoxed)
	teamBoxed.ServerHeader = &chat1.MessageServerHeader{
		Ctime:     gregor1.ToTime(time.Now()),
		MessageID: 3,
	}

	conv.Metadata.MembersType = chat1.ConversationMembersType_IMPTEAMUPGRADE
	unboxed, err := boxer.UnboxMessages(ctx, []chat1.MessageBoxed{*teamBoxed, *kbfsBoxed}, conv)
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
