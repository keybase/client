package chat

import (
	"testing"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

func TestAttachmentGalleryNextMessage(t *testing.T) {
	ctc := makeChatTestContext(t, "TestAttachmentGalleryNextMessage", 1)
	defer ctc.cleanup()
	users := ctc.users()
	defer func() {
		useRemoteMock = true
	}()
	useRemoteMock = false

	tc := ctc.world.Tcs[users[0].Username]
	gallery := attachments.NewGallery(tc.Context())
	uid := gregor1.UID(users[0].GetUID().ToBytes())
	listener := newServerChatListener()
	ctc.as(t, users[0]).h.G().NotifyRouter.SetListener(listener)
	conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE)
	ctx := ctc.as(t, users[0]).startCtx

	m0Res, err := postLocalForTest(t, ctc, users[0], conv,
		chat1.NewMessageBodyWithAttachment(chat1.MessageAttachment{
			Object: chat1.Asset{
				Path:     "m0",
				Metadata: chat1.NewAssetMetadataWithImage(chat1.AssetMetadataImage{}),
			},
		}))
	require.NoError(t, err)
	consumeNewMsgRemote(t, listener, chat1.MessageType_ATTACHMENT)
	m1Res, err := postLocalForTest(t, ctc, users[0], conv,
		chat1.NewMessageBodyWithAttachment(chat1.MessageAttachment{
			Object: chat1.Asset{
				Path: "m1",
			},
		}))
	require.NoError(t, err)
	consumeNewMsgRemote(t, listener, chat1.MessageType_ATTACHMENT)
	_, err = postLocalForTest(t, ctc, users[0], conv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "m2",
	}))
	require.NoError(t, err)
	consumeNewMsgRemote(t, listener, chat1.MessageType_TEXT)
	m3Res, err := postLocalForTest(t, ctc, users[0], conv,
		chat1.NewMessageBodyWithAttachment(chat1.MessageAttachment{
			Object: chat1.Asset{
				Path:     "m3",
				Metadata: chat1.NewAssetMetadataWithVideo(chat1.AssetMetadataVideo{}),
			},
		}))
	require.NoError(t, err)
	consumeNewMsgRemote(t, listener, chat1.MessageType_ATTACHMENT)

	t.Logf("case: backintime all attachments")
	nm, err := gallery.NextMessage(ctx, uid, conv.Id, m3Res.MessageID,
		attachments.NextMessageOptions{
			BackInTime: true,
		})
	require.NoError(t, err)
	require.NotNil(t, nm)
	require.Equal(t, nm.GetMessageID(), m1Res.MessageID)
	t.Logf("case: backintime imagesonly")
	nm, err = gallery.NextMessage(ctx, uid, conv.Id, m3Res.MessageID,
		attachments.NextMessageOptions{
			BackInTime: true,
			ImagesOnly: true,
		})
	require.NoError(t, err)
	require.NotNil(t, nm)
	require.Equal(t, nm.GetMessageID(), m0Res.MessageID)
	t.Logf("case: forwardintime all attachments")
	nm, err = gallery.NextMessage(ctx, uid, conv.Id, m0Res.MessageID,
		attachments.NextMessageOptions{
			BackInTime: false,
		})
	require.NoError(t, err)
	require.NotNil(t, nm)
	require.Equal(t, nm.GetMessageID(), m1Res.MessageID)
	t.Logf("case: forwardintime imagesonly")
	nm, err = gallery.NextMessage(ctx, uid, conv.Id, m0Res.MessageID,
		attachments.NextMessageOptions{
			BackInTime: false,
			ImagesOnly: true,
		})
	require.NoError(t, err)
	require.NotNil(t, nm)
	require.Equal(t, nm.GetMessageID(), m3Res.MessageID)
	t.Logf("case: backintime off the end")
	nm, err = gallery.NextMessage(ctx, uid, conv.Id, m0Res.MessageID,
		attachments.NextMessageOptions{
			BackInTime: true,
		})
	require.NoError(t, err)
	require.Nil(t, nm)
	t.Logf("case: forwardintime off the end")
	nm, err = gallery.NextMessage(ctx, uid, conv.Id, m3Res.MessageID,
		attachments.NextMessageOptions{
			BackInTime: false,
		})
	require.NoError(t, err)
	require.Nil(t, nm)

	gallery.NextStride = 1
	gallery.PrevStride = 1
	t.Logf("case: backintime short stride")
	nm, err = gallery.NextMessage(ctx, uid, conv.Id, m3Res.MessageID,
		attachments.NextMessageOptions{
			BackInTime: true,
			ImagesOnly: true,
		})
	require.NoError(t, err)
	require.NotNil(t, nm)
	require.Equal(t, nm.GetMessageID(), m0Res.MessageID)
	t.Logf("case: forwardintime short stride")
	nm, err = gallery.NextMessage(ctx, uid, conv.Id, m0Res.MessageID,
		attachments.NextMessageOptions{
			BackInTime: false,
			ImagesOnly: true,
		})
	require.NoError(t, err)
	require.NotNil(t, nm)
	require.Equal(t, nm.GetMessageID(), m3Res.MessageID)
}
