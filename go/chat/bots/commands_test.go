package bots

import (
	"context"
	"testing"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

type botInfoRemote struct {
	chat1.RemoteInterface
	response chat1.GetBotInfoRes
}

func (r botInfoRemote) GetBotInfo(context.Context, chat1.GetBotInfoArg) (chat1.GetBotInfoRes, error) {
	return r.response, nil
}

func TestCommandsStorageMatchesInfoHash(t *testing.T) {
	info := chat1.BotInfo{ClientHashVers: chat1.ClientBotInfoHashVers}
	infoHash := info.Hash()

	tests := map[string]struct {
		storage commandsStorage
		match   bool
	}{
		"current": {
			storage: commandsStorage{
				InfoHash: infoHash,
				Version:  storageVersion,
			},
			match: true,
		},
		"missing hash": {
			storage: commandsStorage{Version: storageVersion},
		},
		"mismatched hash": {
			storage: commandsStorage{
				InfoHash: chat1.BotInfo{ClientHashVers: 0}.Hash(),
				Version:  storageVersion,
			},
		},
		"old version": {
			storage: commandsStorage{
				InfoHash: infoHash,
				Version:  storageVersion - 1,
			},
		},
	}

	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			require.Equal(t, test.match, test.storage.matchesInfoHash(infoHash))
		})
	}
}

func TestGetBotInfoRebuildsForStaleCommandCache(t *testing.T) {
	tc := externalstest.SetupTest(t, "bot-command-cache-provenance", 0)
	defer tc.Cleanup()

	g := globals.NewContext(tc.G, &globals.ChatContext{})
	ctx := context.Background()
	info := chat1.BotInfo{ClientHashVers: chat1.ClientBotInfoHashVers}
	convID := chat1.ConversationID("conv")

	manager := NewCachingBotCommandManager(g, func() chat1.RemoteInterface {
		return botInfoRemote{response: chat1.GetBotInfoRes{
			Response: chat1.NewBotInfoResponseWithUptodate(),
		}}
	}, nil)
	manager.uid = gregor1.UID("uid")
	manager.edb = encrypteddb.New(tc.G,
		func(g *libkb.GlobalContext) *libkb.JSONLocalDb { return g.LocalChatDb },
		func(context.Context) ([32]byte, error) { return [32]byte{1}, nil })
	require.NoError(t, manager.edb.Put(ctx, manager.dbInfoKey(convID), info))

	tests := map[string]struct {
		storage *commandsStorage
		update  bool
	}{
		"matching provenance": {
			storage: &commandsStorage{
				InfoHash: info.Hash(),
				Version:  storageVersion,
			},
		},
		"missing provenance": {
			storage: &commandsStorage{Version: storageVersion},
			update:  true,
		},
		"missing cache": {
			update: true,
		},
		"mismatched provenance": {
			storage: &commandsStorage{
				InfoHash: chat1.BotInfo{ClientHashVers: 0}.Hash(),
				Version:  storageVersion,
			},
			update: true,
		},
		"legacy version": {
			storage: &commandsStorage{
				InfoHash: info.Hash(),
				Version:  storageVersion - 1,
			},
			update: true,
		},
	}

	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			require.NoError(t, manager.edb.Delete(ctx, manager.dbCommandsKey(convID)))
			if test.storage != nil {
				require.NoError(t, manager.edb.Put(ctx, manager.dbCommandsKey(convID), test.storage))
			}
			gotInfo, doUpdate, err := manager.getBotInfo(ctx, &commandUpdaterJob{convID: convID})
			require.NoError(t, err)
			require.Equal(t, info, gotInfo)
			require.Equal(t, test.update, doUpdate)
		})
	}
}
