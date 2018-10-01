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

func TestIndexAdd(t *testing.T) {
	world := kbtest.NewChatMockWorld(t, "indexer", 1)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	uid := u.User.GetUID().ToBytes()
	tc := world.Tcs[u.Username]
	g := globals.NewContext(tc.G, tc.ChatG)
	indexer := NewIndexer(g)
	ctx := context.TODO()
	testMsgMetadata := msgMetadata{
		SenderUsername: testSenderUsername,
		Ctime:          testCtime,
	}

	convID1 := chat1.ConversationID("conv1")
	dbKey1 := indexer.dbKey(convID1, uid)
	convIdx, err := indexer.getConvIndex(ctx, dbKey1)
	require.NoError(t, err)
	require.Equal(t, convIndex{}, convIdx)

	msg1 := makeText(5, "The quick brown fox jumps over the lazy dog.")
	err = indexer.Add(ctx, convID1, uid, msg1)
	require.NoError(t, err)

	expectedConvIdx := convIndex{
		"the":   msgMetadataIndex{5: testMsgMetadata},
		"quick": msgMetadataIndex{5: testMsgMetadata},
		"brown": msgMetadataIndex{5: testMsgMetadata},
		"fox":   msgMetadataIndex{5: testMsgMetadata},
		"jumps": msgMetadataIndex{5: testMsgMetadata},
		"over":  msgMetadataIndex{5: testMsgMetadata},
		"lazy":  msgMetadataIndex{5: testMsgMetadata},
		"dog":   msgMetadataIndex{5: testMsgMetadata},
	}

	convIdx, err = indexer.getConvIndex(ctx, dbKey1)
	require.NoError(t, err)
	require.Equal(t, expectedConvIdx, convIdx)

	msg2 := makeText(6, "> The quick brown fox jumps over the lazy dog.\n cool.")
	err = indexer.Add(ctx, convID1, uid, msg2)
	require.NoError(t, err)

	expectedConvIdx2 := convIndex{
		"the":   msgMetadataIndex{5: testMsgMetadata, 6: testMsgMetadata},
		"quick": msgMetadataIndex{5: testMsgMetadata, 6: testMsgMetadata},
		"brown": msgMetadataIndex{5: testMsgMetadata, 6: testMsgMetadata},
		"fox":   msgMetadataIndex{5: testMsgMetadata, 6: testMsgMetadata},
		"jumps": msgMetadataIndex{5: testMsgMetadata, 6: testMsgMetadata},
		"over":  msgMetadataIndex{5: testMsgMetadata, 6: testMsgMetadata},
		"lazy":  msgMetadataIndex{5: testMsgMetadata, 6: testMsgMetadata},
		"dog":   msgMetadataIndex{5: testMsgMetadata, 6: testMsgMetadata},
		"cool":  msgMetadataIndex{6: testMsgMetadata},
	}

	convIdx, err = indexer.getConvIndex(ctx, dbKey1)
	require.NoError(t, err)
	require.Equal(t, expectedConvIdx2, convIdx)

	convID2 := chat1.ConversationID("conv2")
	dbKey2 := indexer.dbKey(convID2, uid)
	err = indexer.Add(ctx, convID2, uid, msg1)
	require.NoError(t, err)

	convIdx, err = indexer.getConvIndex(ctx, dbKey2)
	require.NoError(t, err)
	require.Equal(t, expectedConvIdx, convIdx)
}
