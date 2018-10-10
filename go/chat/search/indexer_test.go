package search

import (
	"context"
	"testing"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"
)

const testSenderUsername = "test"
const testCtime = 1234

func makeText(id chat1.MessageID, text string) chat1.MessageUnboxed {
	msg := chat1.MessageUnboxedValid{
		ServerHeader: chat1.MessageServerHeader{
			MessageID: id,
			Ctime:     testCtime,
		},
		SenderUsername: testSenderUsername,
		ClientHeader: chat1.MessageClientHeaderVerified{
			MessageType: chat1.MessageType_TEXT,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: text,
		}),
	}
	return chat1.NewMessageUnboxedWithValid(msg)
}

func TestIndexer(t *testing.T) {
	world := kbtest.NewChatMockWorld(t, "indexer", 1)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	uid := u.User.GetUID().ToBytes()
	tc := world.Tcs[u.Username]
	g := globals.NewContext(tc.G, tc.ChatG)
	indexer := NewIndexer(g)
	ctx := context.TODO()

	convID1 := chat1.ConversationID("conv1")
	dbKey1 := indexer.dbKey(convID1, uid)
	convIdx, err := indexer.getConvIndex(ctx, dbKey1)
	require.NoError(t, err)
	require.Equal(t, convIndex{}, convIdx)

	// add first message
	msg1 := makeText(5, "The quick brown fox jumps over the lazy dog.")
	err = indexer.Add(ctx, convID1, uid, msg1)
	require.NoError(t, err)

	expectedConvIdx := convIndex{
		"the":   map[chat1.MessageID]bool{5: true},
		"quick": map[chat1.MessageID]bool{5: true},
		"brown": map[chat1.MessageID]bool{5: true},
		"fox":   map[chat1.MessageID]bool{5: true},
		"jumps": map[chat1.MessageID]bool{5: true},
		"over":  map[chat1.MessageID]bool{5: true},
		"lazy":  map[chat1.MessageID]bool{5: true},
		"dog":   map[chat1.MessageID]bool{5: true},
	}

	convIdx, err = indexer.getConvIndex(ctx, dbKey1)
	require.NoError(t, err)
	require.Equal(t, expectedConvIdx, convIdx)

	// add second message with overlapping keys
	msg2 := makeText(6, "> The quick brown fox jumps over the lazy dog.\n cool.")
	err = indexer.Add(ctx, convID1, uid, msg2)
	require.NoError(t, err)

	expectedConvIdx2 := convIndex{
		"the":   map[chat1.MessageID]bool{5: true, 6: true},
		"quick": map[chat1.MessageID]bool{5: true, 6: true},
		"brown": map[chat1.MessageID]bool{5: true, 6: true},
		"fox":   map[chat1.MessageID]bool{5: true, 6: true},
		"jumps": map[chat1.MessageID]bool{5: true, 6: true},
		"over":  map[chat1.MessageID]bool{5: true, 6: true},
		"lazy":  map[chat1.MessageID]bool{5: true, 6: true},
		"dog":   map[chat1.MessageID]bool{5: true, 6: true},
		"cool":  map[chat1.MessageID]bool{6: true},
	}

	convIdx, err = indexer.getConvIndex(ctx, dbKey1)
	require.NoError(t, err)
	require.Equal(t, expectedConvIdx2, convIdx)

	// add first message to conv2
	convID2 := chat1.ConversationID("conv2")
	dbKey2 := indexer.dbKey(convID2, uid)
	err = indexer.Add(ctx, convID2, uid, msg1)
	require.NoError(t, err)
	convIdx, err = indexer.getConvIndex(ctx, dbKey2)
	require.NoError(t, err)
	require.Equal(t, expectedConvIdx, convIdx)

	// remove from conv2
	err = indexer.Remove(ctx, convID2, uid, msg1)
	require.NoError(t, err)
	convIdx, err = indexer.getConvIndex(ctx, dbKey2)
	require.NoError(t, err)
	require.Equal(t, convIndex{}, convIdx)

	// remove msg1 from conv1
	err = indexer.Remove(ctx, convID1, uid, msg1)
	require.NoError(t, err)

	expectedConvIdx3 := convIndex{
		"the":   map[chat1.MessageID]bool{6: true},
		"quick": map[chat1.MessageID]bool{6: true},
		"brown": map[chat1.MessageID]bool{6: true},
		"fox":   map[chat1.MessageID]bool{6: true},
		"jumps": map[chat1.MessageID]bool{6: true},
		"over":  map[chat1.MessageID]bool{6: true},
		"lazy":  map[chat1.MessageID]bool{6: true},
		"dog":   map[chat1.MessageID]bool{6: true},
		"cool":  map[chat1.MessageID]bool{6: true},
	}
	convIdx, err = indexer.getConvIndex(ctx, dbKey1)
	require.NoError(t, err)
	require.Equal(t, expectedConvIdx3, convIdx)

	// remove msg2 from conv2
	err = indexer.Remove(ctx, convID1, uid, msg2)
	require.NoError(t, err)

	convIdx, err = indexer.getConvIndex(ctx, dbKey1)
	require.NoError(t, err)
	require.Equal(t, convIndex{}, convIdx)
}
