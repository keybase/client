package attachments

import (
	"errors"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type Sender struct {
	globals.Contextified
	utils.DebugLabeler
}

func NewSender(gc *globals.Context) *Sender {
	return &Sender{
		Contextified: globals.NewContextified(gc),
		DebugLabeler: utils.NewDebugLabeler(gc.GetLog(), "Attachments.Sender", false),
	}
}

func (s *Sender) MakePreview(ctx context.Context, filename string, outboxID chat1.OutboxID) (res chat1.MakePreviewRes, err error) {
	defer s.Trace(ctx, func() error { return err }, "MakePreview")()
	src, err := NewReadCloseResetter(ctx, s.G().GlobalContext, filename)
	if err != nil {
		return res, err
	}
	defer src.Close()
	pre, err := PreprocessAsset(ctx, s.G(), s.DebugLabeler, src, filename, s.G().NativeVideoHelper, nil)
	if err != nil {
		return chat1.MakePreviewRes{}, err
	}
	if pre.Preview != nil {
		if err := NewPendingPreviews(s.G()).Put(ctx, outboxID, pre); err != nil {
			return res, err
		}
		return pre.Export(func() *chat1.PreviewLocation {
			loc := chat1.NewPreviewLocationWithUrl(s.G().AttachmentURLSrv.GetPendingPreviewURL(ctx, outboxID))
			return &loc
		})
	}
	return pre.Export(func() *chat1.PreviewLocation { return nil })
}

func (s *Sender) preprocess(ctx context.Context, filename string, callerPreview *chat1.MakePreviewRes) (res Preprocess, err error) {
	src, err := NewReadCloseResetter(ctx, s.G().GlobalContext, filename)
	if err != nil {
		return res, err
	}
	defer src.Close()
	return PreprocessAsset(ctx, s.G(), s.DebugLabeler, src, filename, s.G().NativeVideoHelper, callerPreview)
}

func (s *Sender) makeBaseAttachmentMessage(ctx context.Context, tlfName string, vis keybase1.TLFVisibility,
	inOutboxID *chat1.OutboxID, filename, title string, md []byte, ephemeralLifetime *gregor1.DurationSec,
	callerPreview *chat1.MakePreviewRes) (msg chat1.MessagePlaintext, outboxID chat1.OutboxID, err error) {
	if inOutboxID == nil {
		if outboxID, err = storage.NewOutboxID(); err != nil {
			return msg, outboxID, err
		}
	} else {
		outboxID = *inOutboxID
	}
	msg = chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			MessageType: chat1.MessageType_ATTACHMENT,
			TlfName:     tlfName,
			TlfPublic:   vis == keybase1.TLFVisibility_PUBLIC,
			OutboxID:    &outboxID,
		},
		MessageBody: chat1.NewMessageBodyWithAttachment(chat1.MessageAttachment{
			Object: chat1.Asset{
				Title:    title,
				Filename: filename,
			},
			Metadata: md,
		}),
	}
	if ephemeralLifetime != nil {
		msg.ClientHeader.EphemeralMetadata = &chat1.MsgEphemeralMetadata{
			Lifetime: *ephemeralLifetime,
		}
	}
	if pre, err := s.preprocess(ctx, filename, callerPreview); err != nil {
		// If we can't generate a preview here, let's not blow the whole thing up, we can try
		// again when we are actually uploading the attachment
		s.Debug(ctx, "makeBaseAttachmentMessage: failed to process caller preview, skipping: %s", err)
	} else {
		if err := NewPendingPreviews(s.G()).Put(ctx, outboxID, pre); err != nil {
			s.Debug(ctx, "makeBaseAttachmentMessage: failed to save pending preview: %s", err)
		}
	}

	return msg, outboxID, nil
}

func (s *Sender) PostFileAttachmentMessage(ctx context.Context, sender types.Sender,
	convID chat1.ConversationID, tlfName string, vis keybase1.TLFVisibility, inOutboxID *chat1.OutboxID,
	filename, title string, md []byte, clientPrev chat1.MessageID, ephemeralLifetime *gregor1.DurationSec,
	callerPreview *chat1.MakePreviewRes) (outboxID chat1.OutboxID, msgID *chat1.MessageID, err error) {
	defer s.Trace(ctx, func() error { return err }, "PostFileAttachmentMessage")()
	var msg chat1.MessagePlaintext
	if msg, outboxID, err = s.makeBaseAttachmentMessage(ctx, tlfName, vis, inOutboxID, filename, title, md,
		ephemeralLifetime, callerPreview); err != nil {
		return outboxID, msgID, err
	}
	s.Debug(ctx, "PostFileAttachmentMessage: generated message with outbox ID: %s", outboxID)
	_, boxed, err := sender.Send(ctx, convID, msg, clientPrev, &outboxID, nil, nil)
	if err != nil {
		return outboxID, msgID, err
	}
	if boxed != nil && boxed.ServerHeader != nil {
		msgID = new(chat1.MessageID)
		*msgID = boxed.GetMessageID()
	}
	return outboxID, msgID, nil
}

func (s *Sender) PostFileAttachment(ctx context.Context, sender types.Sender, uid gregor1.UID,
	convID chat1.ConversationID, tlfName string, vis keybase1.TLFVisibility, inOutboxID *chat1.OutboxID,
	filename, title string, md []byte, clientPrev chat1.MessageID, ephemeralLifetime *gregor1.DurationSec,
	callerPreview *chat1.MakePreviewRes) (outboxID chat1.OutboxID, msgID *chat1.MessageID, err error) {
	defer s.Trace(ctx, func() error { return err }, "PostFileAttachment")()
	var msg chat1.MessagePlaintext
	if msg, outboxID, err = s.makeBaseAttachmentMessage(ctx, tlfName, vis, inOutboxID, filename, title, md,
		ephemeralLifetime, callerPreview); err != nil {
		return outboxID, msgID, err
	}
	// Start upload
	uresCb, err := s.G().AttachmentUploader.Register(ctx, uid, convID, outboxID, title, filename, md,
		callerPreview)
	if err != nil {
		return outboxID, msgID, err
	}
	// Wait for upload
	ures := <-uresCb.Wait()
	if ures.Error != nil {
		s.Debug(ctx, "PostFileAttachment: upload failed, bailing out: %s", *ures.Error)
		return outboxID, msgID, errors.New(*ures.Error)
	}
	// Fill in the rest of the message
	attachment := chat1.MessageAttachment{
		Object:   ures.Object,
		Metadata: md,
		Uploaded: true,
	}
	if ures.Preview != nil {
		s.Debug(ctx, "PostFileAttachment: attachment preview asset added")
		attachment.Previews = []chat1.Asset{*ures.Preview}
		attachment.Preview = ures.Preview
	}
	msg.MessageBody = chat1.NewMessageBodyWithAttachment(attachment)

	s.Debug(ctx, "PostFileAttachment: attachment assets uploaded, posting attachment message")
	_, boxed, err := sender.Send(ctx, convID, msg, clientPrev, &outboxID, nil, nil)
	if err != nil {
		return outboxID, msgID, err
	}
	if boxed != nil && boxed.ServerHeader != nil {
		msgID = new(chat1.MessageID)
		*msgID = boxed.GetMessageID()
	}
	return outboxID, msgID, nil
}
