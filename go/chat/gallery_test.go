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
	ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener)
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
	nm, _, err := gallery.NextMessage(ctx, uid, conv.Id, m3Res.MessageID,
		attachments.NextMessageOptions{
			BackInTime: true,
		})
	require.NoError(t, err)
	require.NotNil(t, nm)
	require.Equal(t, nm.GetMessageID(), m1Res.MessageID)
	t.Logf("case: backintime imagesonly")
	nm, _, err = gallery.NextMessage(ctx, uid, conv.Id, m3Res.MessageID,
		attachments.NextMessageOptions{
			BackInTime: true,
			AssetTypes: []chat1.AssetMetadataType{chat1.AssetMetadataType_IMAGE, chat1.AssetMetadataType_VIDEO},
		})
	require.NoError(t, err)
	require.NotNil(t, nm)
	require.Equal(t, nm.GetMessageID(), m0Res.MessageID)
	t.Logf("case: forwardintime all attachments")
	nm, _, err = gallery.NextMessage(ctx, uid, conv.Id, m0Res.MessageID,
		attachments.NextMessageOptions{
			BackInTime: false,
		})
	require.NoError(t, err)
	require.NotNil(t, nm)
	require.Equal(t, nm.GetMessageID(), m1Res.MessageID)
	t.Logf("case: forwardintime imagesonly")
	nm, _, err = gallery.NextMessage(ctx, uid, conv.Id, m0Res.MessageID,
		attachments.NextMessageOptions{
			BackInTime: false,
			AssetTypes: []chat1.AssetMetadataType{chat1.AssetMetadataType_IMAGE, chat1.AssetMetadataType_VIDEO},
		})
	require.NoError(t, err)
	require.NotNil(t, nm)
	require.Equal(t, nm.GetMessageID(), m3Res.MessageID)
	t.Logf("case: backintime off the end")
	nm, _, err = gallery.NextMessage(ctx, uid, conv.Id, m0Res.MessageID,
		attachments.NextMessageOptions{
			BackInTime: true,
		})
	require.NoError(t, err)
	require.Nil(t, nm)
	t.Logf("case: forwardintime off the end")
	nm, _, err = gallery.NextMessage(ctx, uid, conv.Id, m3Res.MessageID,
		attachments.NextMessageOptions{
			BackInTime: false,
		})
	require.NoError(t, err)
	require.Nil(t, nm)

	gallery.NextStride = 1
	gallery.PrevStride = 1
	t.Logf("case: backintime short stride")
	nm, _, err = gallery.NextMessage(ctx, uid, conv.Id, m3Res.MessageID,
		attachments.NextMessageOptions{
			BackInTime: true,
			AssetTypes: []chat1.AssetMetadataType{chat1.AssetMetadataType_IMAGE, chat1.AssetMetadataType_VIDEO},
		})
	require.NoError(t, err)
	require.NotNil(t, nm)
	require.Equal(t, nm.GetMessageID(), m0Res.MessageID)
	t.Logf("case: forwardintime short stride")
	nm, _, err = gallery.NextMessage(ctx, uid, conv.Id, m0Res.MessageID,
		attachments.NextMessageOptions{
			BackInTime: false,
			AssetTypes: []chat1.AssetMetadataType{chat1.AssetMetadataType_IMAGE, chat1.AssetMetadataType_VIDEO},
		})
	require.NoError(t, err)
	require.NotNil(t, nm)
	require.Equal(t, nm.GetMessageID(), m3Res.MessageID)
}

func TestAttachmentGalleryLinks(t *testing.T) {
	ctc := makeChatTestContext(t, "TestAttachmentGalleryLinks", 1)
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
	ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener)
	conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE)
	ctx := ctc.as(t, users[0]).startCtx

	_, err := postLocalForTest(t, ctc, users[0], conv,
		chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: "https://www.google.com",
		}))
	require.NoError(t, err)
	consumeNewMsgRemote(t, listener, chat1.MessageType_TEXT)
	_, err = postLocalForTest(t, ctc, users[0], conv,
		chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: "MIKE",
		}))
	require.NoError(t, err)
	consumeNewMsgRemote(t, listener, chat1.MessageType_TEXT)
	m1Res, err := postLocalForTest(t, ctc, users[0], conv,
		chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: "https://www.keybase.io",
		}))
	require.NoError(t, err)
	consumeNewMsgRemote(t, listener, chat1.MessageType_TEXT)

	nm, last, err := gallery.NextMessages(ctx, uid, conv.Id, m1Res.MessageID+1, 5,
		attachments.NextMessageOptions{
			BackInTime:  true,
			MessageType: chat1.MessageType_TEXT,
			FilterLinks: true,
		}, nil)
	require.NoError(t, err)
	require.True(t, last)
	require.Equal(t, 2, len(nm))

	nm, last, err = gallery.NextMessages(ctx, uid, conv.Id, m1Res.MessageID+1, 1,
		attachments.NextMessageOptions{
			BackInTime:  true,
			MessageType: chat1.MessageType_TEXT,
			FilterLinks: true,
		}, nil)
	require.NoError(t, err)
	require.False(t, last)
	require.Equal(t, 1, len(nm))

	nm, last, err = gallery.NextMessages(ctx, uid, conv.Id, m1Res.MessageID, 2,
		attachments.NextMessageOptions{
			BackInTime:  true,
			MessageType: chat1.MessageType_TEXT,
			FilterLinks: true,
		}, nil)
	require.NoError(t, err)
	require.True(t, last)
	require.Equal(t, 1, len(nm))

}

func TestAttachmentGalleryPagination(t *testing.T) {
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
	ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener)
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
	for i := 0; i < 10; i++ {
		_, err = postLocalForTest(t, ctc, users[0], conv,
			chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: "MIKE",
			}))
		require.NoError(t, err)
		consumeNewMsgRemote(t, listener, chat1.MessageType_TEXT)
	}
	m2Res, err := postLocalForTest(t, ctc, users[0], conv,
		chat1.NewMessageBodyWithAttachment(chat1.MessageAttachment{
			Object: chat1.Asset{
				Path:     "m2",
				Metadata: chat1.NewAssetMetadataWithImage(chat1.AssetMetadataImage{}),
			},
		}))
	require.NoError(t, err)
	consumeNewMsgRemote(t, listener, chat1.MessageType_ATTACHMENT)
	m3Res, err := postLocalForTest(t, ctc, users[0], conv,
		chat1.NewMessageBodyWithAttachment(chat1.MessageAttachment{
			Object: chat1.Asset{
				Path:     "m3",
				Metadata: chat1.NewAssetMetadataWithImage(chat1.AssetMetadataImage{}),
			},
		}))
	require.NoError(t, err)
	consumeNewMsgRemote(t, listener, chat1.MessageType_ATTACHMENT)

	nm, last, err := gallery.NextMessages(ctx, uid, conv.Id, m3Res.MessageID+1, 2,
		attachments.NextMessageOptions{
			BackInTime: true,
			AssetTypes: []chat1.AssetMetadataType{chat1.AssetMetadataType_IMAGE, chat1.AssetMetadataType_VIDEO},
		}, nil)
	require.NoError(t, err)
	require.False(t, last)
	require.Equal(t, 2, len(nm))

	nm, last, err = gallery.NextMessages(ctx, uid, conv.Id, m2Res.MessageID+1, 2,
		attachments.NextMessageOptions{
			BackInTime: true,
			AssetTypes: []chat1.AssetMetadataType{chat1.AssetMetadataType_IMAGE, chat1.AssetMetadataType_VIDEO},
		}, nil)
	require.NoError(t, err)
	require.Equal(t, 2, len(nm))
	require.False(t, last)

	nm, last, err = gallery.NextMessages(ctx, uid, conv.Id, m0Res.MessageID, 2,
		attachments.NextMessageOptions{
			BackInTime: true,
			AssetTypes: []chat1.AssetMetadataType{chat1.AssetMetadataType_IMAGE, chat1.AssetMetadataType_VIDEO},
		}, nil)
	require.NoError(t, err)
	require.Zero(t, len(nm))
	require.True(t, last)

	nm, last, err = gallery.NextMessages(ctx, uid, conv.Id, m3Res.MessageID+1, 5,
		attachments.NextMessageOptions{
			BackInTime: true,
			AssetTypes: []chat1.AssetMetadataType{chat1.AssetMetadataType_IMAGE, chat1.AssetMetadataType_VIDEO},
		}, nil)
	require.NoError(t, err)
	require.Equal(t, 3, len(nm))
	require.True(t, last)
}
