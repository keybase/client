// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
)

type ChatUI struct {
	libkb.Contextified
	terminal            libkb.TerminalUI
	noOutput            bool
	lastPercentReported int
}

func (c *ChatUI) ChatAttachmentUploadOutboxID(context.Context, chat1.ChatAttachmentUploadOutboxIDArg) error {
	return nil
}

func (c *ChatUI) ChatAttachmentUploadStart(context.Context, chat1.ChatAttachmentUploadStartArg) error {
	if c.noOutput {
		return nil
	}
	w := c.terminal.ErrorWriter()
	fmt.Fprintf(w, "Attachment upload "+ColorString("green", "starting")+"\n")
	return nil
}

func (c *ChatUI) ChatAttachmentUploadProgress(ctx context.Context, arg chat1.ChatAttachmentUploadProgressArg) error {
	if c.noOutput {
		return nil
	}
	percent := int((100 * arg.BytesComplete) / arg.BytesTotal)
	if c.lastPercentReported == 0 || percent == 100 || percent-c.lastPercentReported >= 10 {
		w := c.terminal.ErrorWriter()
		fmt.Fprintf(w, "Attachment upload progress %d%% (%d of %d bytes uploaded)\n", percent, arg.BytesComplete, arg.BytesTotal)
		c.lastPercentReported = percent
	}
	return nil
}

func (c *ChatUI) ChatAttachmentUploadDone(context.Context, int) error {
	if c.noOutput {
		return nil
	}
	w := c.terminal.ErrorWriter()
	fmt.Fprintf(w, "Attachment upload "+ColorString("magenta", "finished")+"\n")
	return nil
}

func (c *ChatUI) ChatAttachmentPreviewUploadStart(context.Context, chat1.ChatAttachmentPreviewUploadStartArg) error {
	if c.noOutput {
		return nil
	}
	w := c.terminal.ErrorWriter()
	fmt.Fprintf(w, "Attachment preview upload "+ColorString("green", "starting")+"\n")
	return nil
}

func (c *ChatUI) ChatAttachmentPreviewUploadDone(context.Context, int) error {
	if c.noOutput {
		return nil
	}
	w := c.terminal.ErrorWriter()
	fmt.Fprintf(w, "Attachment preview upload "+ColorString("magenta", "finished")+"\n")
	return nil
}

func (c *ChatUI) ChatAttachmentDownloadStart(context.Context, int) error {
	if c.noOutput {
		return nil
	}
	w := c.terminal.ErrorWriter()
	fmt.Fprintf(w, "Attachment download "+ColorString("green", "starting")+"\n")
	return nil
}

func (c *ChatUI) ChatAttachmentDownloadProgress(ctx context.Context, arg chat1.ChatAttachmentDownloadProgressArg) error {
	if c.noOutput {
		return nil
	}
	percent := int((100 * arg.BytesComplete) / arg.BytesTotal)
	if c.lastPercentReported == 0 || percent == 100 || percent-c.lastPercentReported >= 10 {
		w := c.terminal.ErrorWriter()
		fmt.Fprintf(w, "Attachment download progress %d%% (%d of %d bytes downloaded)\n", percent, arg.BytesComplete, arg.BytesTotal)
		c.lastPercentReported = percent
	}
	return nil
}

func (c *ChatUI) ChatAttachmentDownloadDone(context.Context, int) error {
	if c.noOutput {
		return nil
	}
	w := c.terminal.ErrorWriter()
	fmt.Fprintf(w, "Attachment download "+ColorString("magenta", "finished")+"\n")
	return nil
}

func (c *ChatUI) ChatInboxConversation(ctx context.Context, arg chat1.ChatInboxConversationArg) error {
	if c.noOutput {
		return nil
	}
	w := c.terminal.ErrorWriter()
	sender := "<unknown>"
	snippet := "<blank>"
	tlf := arg.Conv.Info.TlfName + " (unverified)"
	for _, msg := range arg.Conv.MaxMessages {
		if msg.IsValid() {
			body := msg.Valid().MessageBody
			typ, err := (&body).MessageType()
			if err != nil {
				continue
			}
			if typ != chat1.MessageType_TEXT {
				continue
			}
			sender = msg.Valid().SenderUsername
			snippet = msg.Valid().MessageBody.Text().Body
			tlf = msg.Valid().ClientHeader.TlfName
			break
		}
	}
	fmt.Fprintf(w, "conversation unboxed: tlf: %s sender: %s snippet: %s\n", tlf, sender, snippet)
	return nil
}

func (c *ChatUI) ChatInboxFailed(ctx context.Context, arg chat1.ChatInboxFailedArg) error {
	if c.noOutput {
		return nil
	}
	w := c.terminal.ErrorWriter()
	switch arg.Error.Typ {
	case chat1.ConversationErrorType_SELFREKEYNEEDED, chat1.ConversationErrorType_OTHERREKEYNEEDED:
		fmt.Fprintf(w, "conversation unbox failure: convID: %s err: [%s] %+v\n", arg.ConvID, arg.Error.Typ, arg.Error.RekeyInfo)
	default:
		fmt.Fprintf(w, "conversation unbox failure: convID: %s err: %s\n", arg.ConvID, arg.Error.Message)
	}
	return nil
}

func (c *ChatUI) getUnverifiedConvo(ctx context.Context, conv chat1.Conversation) (chat1.ConversationLocal, error) {
	if len(conv.MaxMsgSummaries) == 0 {
		return chat1.ConversationLocal{}, fmt.Errorf("no max messages")
	}

	// Get max text message
	var txtMsg *chat1.MessageSummary
	for _, msg := range conv.MaxMsgSummaries {
		if msg.GetMessageType() == chat1.MessageType_TEXT {
			txtMsg = &msg
			break
		}
	}
	if txtMsg == nil {
		return chat1.ConversationLocal{}, fmt.Errorf("no text message found")
	}

	// Don't bother with activelist, to avoid loading users from the client.
	wnames, rnames, err := utils.ReorderParticipants(ctx, c.G().GetUPAKLoader(),
		txtMsg.TlfName, nil)
	if err != nil {
		return chat1.ConversationLocal{}, err
	}
	convLocal := chat1.ConversationLocal{
		ReaderInfo: *conv.ReaderInfo,
		MaxMessages: []chat1.MessageUnboxed{
			// This is a fake unboxing, only used for `keybase chat ls --async`
			// The contents have not been verified at all. Don't be fooled.
			chat1.MessageUnboxed{
				State__: chat1.MessageUnboxedState_VALID,
				Valid__: &chat1.MessageUnboxedValid{
					MessageBody: chat1.MessageBody{
						MessageType__: chat1.MessageType_TEXT,
						Text__: &chat1.MessageText{
							Body: "<pending>",
						},
					},
					ClientHeader: chat1.MessageClientHeaderVerified{
						// Conv:         txtMsg.ClientHeader.Conv,
						Conv:        conv.Metadata.IdTriple,
						TlfName:     txtMsg.TlfName,
						TlfPublic:   txtMsg.TlfPublic,
						MessageType: chat1.MessageType_TEXT,
						// Sender:       txtMsg.ClientHeader.Sender,
						// SenderDevice: txtMsg.ClientHeader.SenderDevice,
					},
					// ServerHeader:   *txtMsg.ServerHeader,
					SenderUsername: "???",
				},
			},
		},
		Info: chat1.ConversationInfoLocal{
			Id:          conv.Metadata.ConversationID,
			TlfName:     "<pending>",
			WriterNames: wnames,
			ReaderNames: rnames,
		},
	}

	return convLocal, nil
}

func (c *ChatUI) ChatInboxUnverified(ctx context.Context, arg chat1.ChatInboxUnverifiedArg) error {

	var convs []chat1.ConversationLocal
	for _, conv := range arg.Inbox.ConversationsUnverified {
		convLocal, err := c.getUnverifiedConvo(ctx, conv)
		if err != nil {
			c.G().Log.Error("unable to convert unverified conv: %s", err.Error())
			continue
		}
		convs = append(convs, convLocal)
	}

	if err := conversationListView(convs).show(c.G(), string(c.G().Env.GetUsername()), false); err != nil {
		return err
	}

	return nil
}

func (c *ChatUI) ChatThreadCached(ctx context.Context, arg chat1.ChatThreadCachedArg) error {
	return nil
}

func (c *ChatUI) ChatThreadFull(ctx context.Context, arg chat1.ChatThreadFullArg) error {
	return nil
}
