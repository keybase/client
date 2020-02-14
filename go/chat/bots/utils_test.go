package bots

import (
	"context"
	"crypto/sha256"
	"testing"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

var mockCmdOutput []chat1.UserBotCommandOutput

type MockBotCommandManager struct{ types.DummyBotCommandManager }

func (m MockBotCommandManager) ListCommands(context.Context, chat1.ConversationID) ([]chat1.UserBotCommandOutput, map[string]string, error) {
	return mockCmdOutput, make(map[string]string), nil
}

type mockUPAKLoader struct {
	libkb.UPAKLoader
}

func (m mockUPAKLoader) LookupUsername(ctx context.Context, uid keybase1.UID) (libkb.NormalizedUsername, error) {
	return libkb.NewNormalizedUsername("botua"), nil
}

func TestApplyTeamBotSettings(t *testing.T) {
	tc := externalstest.SetupTest(t, "chat-utils", 0)
	defer tc.Cleanup()

	g := globals.NewContext(tc.G, &globals.ChatContext{})
	tc.G.OverrideUPAKLoader(mockUPAKLoader{})
	debugLabeler := utils.NewDebugLabeler(g.GetLog(), g.GetPerfLog(), "ApplyTeamBotSettings", false)
	ctx := context.TODO()
	convID := chat1.ConversationID([]byte("conv"))
	botUID := gregor1.UID([]byte("botua"))
	botSettings := keybase1.TeamBotSettings{}
	msg := chat1.MessagePlaintext{}
	mentionMap := make(map[string]struct{})

	assertMatch := func(expected bool) {
		isMatch, err := ApplyTeamBotSettings(ctx, g, botUID, botSettings, msg, &convID,
			mentionMap, debugLabeler)
		require.NoError(t, err)
		require.Equal(t, expected, isMatch)
	}

	assertMatch(false)

	// DELETEHISTORY always matches
	msg.ClientHeader = chat1.MessageClientHeader{
		MessageType: chat1.MessageType_DELETEHISTORY,
	}
	assertMatch(true)

	bannedTypes := []chat1.MessageType{
		chat1.MessageType_NONE,
		chat1.MessageType_METADATA,
		chat1.MessageType_TLFNAME,
		chat1.MessageType_HEADLINE,
		chat1.MessageType_JOIN,
		chat1.MessageType_LEAVE,
		chat1.MessageType_SYSTEM,
	}
	for _, typ := range bannedTypes {
		msg.ClientHeader.MessageType = typ
		assertMatch(false)
	}

	// if the sender is botUID, always match
	msg.ClientHeader.MessageType = chat1.MessageType_TEXT
	msg.ClientHeader.Sender = botUID
	assertMatch(true)

	// restrict the bot to certain convs
	botSettings.Convs = []string{"conv"}
	assertMatch(false)
	msg.ClientHeader.Sender = gregor1.UID("hi")
	botSettings.Convs = nil

	// mentions
	mentionMap[botUID.String()] = struct{}{}
	assertMatch(false)

	botSettings.Mentions = true
	assertMatch(true)

	delete(mentionMap, botUID.String())
	assertMatch(false)

	botSettings.Mentions = false
	assertMatch(false)

	// triggers
	msg.MessageBody = chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "shipit",
	})
	assertMatch(false)

	botSettings.Triggers = []string{"shipit"}
	assertMatch(true)

	botSettings.Triggers = []string{".+"}
	assertMatch(true)

	msg.MessageBody = chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "",
	})
	assertMatch(false)

	// invalid trigger regex ignored
	botSettings.Triggers = []string{"*"}
	assertMatch(false)

	botSettings.Triggers = nil
	assertMatch(false)

	g.BotCommandManager = &MockBotCommandManager{}
	mockCmdOutput = []chat1.UserBotCommandOutput{
		{
			Name:     "remind me",
			Username: "botua",
		},
	}
	msg.MessageBody = chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "!remind me ",
	})
	assertMatch(false)
	botSettings.Cmds = true
	assertMatch(true)

	// make sure we only match if the given bot username also matches
	mockCmdOutput = []chat1.UserBotCommandOutput{
		{
			Name:     "remind me",
			Username: "notbotua",
		},
	}
	msg.MessageBody = chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "!remind me ",
	})
	assertMatch(false)

	// make sure we don't match an erroneous command
	msg.MessageBody = chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "!help ",
	})
	assertMatch(false)
}

func TestBotInfoHash(t *testing.T) {
	hash := sha256.New()
	nilHash := chat1.BotInfoHash(hash.Sum(nil))

	// Ensure that the latest ClientBotInfoHashVers case is handled if the
	// version number is incremented.
	var botInfo chat1.BotInfo
	for i := chat1.BotInfoHashVers(0); i <= chat1.ClientBotInfoHashVers; i++ {
		botInfo = chat1.BotInfo{
			ClientHashVers: i,
		}
		require.NotEqual(t, nilHash, botInfo.Hash())
	}

	// bumping the server version changes the hash
	botInfo2 := chat1.BotInfo{
		ServerHashVers: chat1.ServerBotInfoHashVers + 1,
		ClientHashVers: chat1.ClientBotInfoHashVers,
	}
	require.NotEqual(t, botInfo.Hash(), botInfo2.Hash())

	// non-existent client version returns a nil hash
	botInfo = chat1.BotInfo{
		ClientHashVers: chat1.ClientBotInfoHashVers + 1,
	}
	require.Equal(t, nilHash, botInfo.Hash())
}
