// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
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
	fmt.Fprintf(w, "Attachment upload "+ColorString(c.G(), "green", "starting")+"\n")
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
	fmt.Fprintf(w, "Attachment upload "+ColorString(c.G(), "magenta", "finished")+"\n")
	return nil
}

func (c *ChatUI) ChatAttachmentPreviewUploadStart(context.Context, chat1.ChatAttachmentPreviewUploadStartArg) error {
	if c.noOutput {
		return nil
	}
	w := c.terminal.ErrorWriter()
	fmt.Fprintf(w, "Attachment preview upload "+ColorString(c.G(), "green", "starting")+"\n")
	return nil
}

func (c *ChatUI) ChatAttachmentPreviewUploadDone(context.Context, int) error {
	if c.noOutput {
		return nil
	}
	w := c.terminal.ErrorWriter()
	fmt.Fprintf(w, "Attachment preview upload "+ColorString(c.G(), "magenta", "finished")+"\n")
	return nil
}

func (c *ChatUI) ChatAttachmentDownloadStart(context.Context, int) error {
	if c.noOutput {
		return nil
	}
	w := c.terminal.ErrorWriter()
	fmt.Fprintf(w, "Attachment download "+ColorString(c.G(), "green", "starting")+"\n")
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
	fmt.Fprintf(w, "Attachment download "+ColorString(c.G(), "magenta", "finished")+"\n")
	return nil
}

func (c *ChatUI) ChatInboxConversation(ctx context.Context, arg chat1.ChatInboxConversationArg) error {
	return nil
}

func (c *ChatUI) ChatInboxFailed(ctx context.Context, arg chat1.ChatInboxFailedArg) error {
	return nil
}

func (c *ChatUI) ChatInboxUnverified(ctx context.Context, arg chat1.ChatInboxUnverifiedArg) error {
	return nil
}

func (c *ChatUI) ChatThreadCached(ctx context.Context, arg chat1.ChatThreadCachedArg) error {
	return nil
}

func (c *ChatUI) ChatThreadFull(ctx context.Context, arg chat1.ChatThreadFullArg) error {
	return nil
}

func (c *ChatUI) ChatConfirmChannelDelete(ctx context.Context, arg chat1.ChatConfirmChannelDeleteArg) (bool, error) {
	term := c.G().UI.GetTerminalUI()
	term.Printf("WARNING: This will destroy this chat channel and remove it from all members' inbox\n\n")
	confirm := fmt.Sprintf("nuke %s", arg.Channel)
	response, err := term.Prompt(PromptDescriptorDeleteRootTeam,
		fmt.Sprintf("** if you are sure, please type: %q > ", confirm))
	if err != nil {
		return false, err
	}
	return strings.TrimSpace(response) == confirm, nil
}

func (c *ChatUI) ChatSearchHit(ctx context.Context, arg chat1.ChatSearchHitArg) error {
	if c.noOutput {
		return nil
	}
	searchHit := arg.SearchHit
	getMsgPrefix := func(uiMsg *chat1.UIMessage) string {
		m := uiMsg.Valid()
		t := gregor1.FromTime(m.Ctime)
		return fmt.Sprintf("[%s %s] ", m.SenderUsername, shortDurationFromNow(t))
	}

	getContext := func(uiMsg *chat1.UIMessage) string {
		if uiMsg != nil && uiMsg.IsValid() && uiMsg.GetMessageType() == chat1.MessageType_TEXT {
			msgBody := uiMsg.Valid().MessageBody.Text().Body
			return getMsgPrefix(uiMsg) + msgBody + "\n"
		}
		return ""
	}

	highlightHits := func(uiMsg *chat1.UIMessage, hits []string) string {
		if uiMsg != nil && uiMsg.IsValid() && uiMsg.GetMessageType() == chat1.MessageType_TEXT {
			msgBody := uiMsg.Valid().MessageBody.Text().Body
			var hitText string
			for _, hit := range hits {
				hitText = strings.Replace(msgBody, hit, ColorString(c.G(), "red", hit), -1)
			}
			return getMsgPrefix(uiMsg) + hitText
		}
		return ""
	}

	// TODO: This should really use chat_cli_rendering.messageView, but we need
	// to refactor for UIMessage
	hitText := highlightHits(searchHit.HitMessage, searchHit.Matches)
	if hitText != "" {
		w := c.terminal.OutputWriter()
		fmt.Fprintf(w, getContext(searchHit.PrevMessage))
		fmt.Fprintln(w, hitText)
		fmt.Fprintf(w, getContext(searchHit.NextMessage))
		fmt.Fprintln(w, "")
	}
	return nil
}

func (c *ChatUI) ChatSearchDone(ctx context.Context, arg chat1.ChatSearchDoneArg) error {
	if c.noOutput {
		return nil
	}
	w := c.terminal.ErrorWriter()
	fmt.Fprintf(w, "Search complete. Found %d results.", arg.NumHits)
	fmt.Fprintln(w, "")
	return nil
}
