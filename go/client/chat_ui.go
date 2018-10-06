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
	"github.com/keybase/client/go/terminalescaper"
)

type ChatNotifications struct {
	libkb.Contextified
	chat1.NotifyChatInterface
	noOutput            bool
	terminal            libkb.TerminalUI
	lastPercentReported int
}

func (n *ChatNotifications) ChatAttachmentUploadStart(ctx context.Context,
	arg chat1.ChatAttachmentUploadStartArg) error {
	if n.noOutput {
		return nil
	}
	w := n.terminal.ErrorWriter()
	fmt.Fprintf(w, "Attachment upload "+ColorString(n.G(), "green", "starting")+"\n")
	return nil
}

func (n *ChatNotifications) ChatAttachmentUploadProgress(ctx context.Context,
	arg chat1.ChatAttachmentUploadProgressArg) error {
	if n.noOutput {
		return nil
	}
	percent := int((100 * arg.BytesComplete) / arg.BytesTotal)
	if n.lastPercentReported == 0 || percent == 100 || percent-n.lastPercentReported >= 10 {
		w := n.terminal.ErrorWriter()
		fmt.Fprintf(w, "Attachment upload progress %d%% (%d of %d bytes uploaded)\n", percent, arg.BytesComplete, arg.BytesTotal)
		n.lastPercentReported = percent
	}
	return nil
}

type ChatUI struct {
	libkb.Contextified
	terminal            libkb.TerminalUI
	noOutput            bool
	lastPercentReported int
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

func (c *ChatUI) renderSearchHit(ctx context.Context, searchHit chat1.ChatSearchHit) error {
	getMsgPrefix := func(msg chat1.UIMessage) string {
		m := msg.Valid()
		t := gregor1.FromTime(m.Ctime)
		return fmt.Sprintf("[%s %s] ", m.SenderUsername, shortDurationFromNow(t))
	}

	getContext := func(msgs []chat1.UIMessage) string {
		ctx := []string{}
		for _, msg := range msgs {
			if msg.IsValid() && msg.GetMessageType() == chat1.MessageType_TEXT {
				msgBody := msg.Valid().MessageBody.Text().Body
				ctx = append(ctx, getMsgPrefix(msg)+msgBody+"\n")
			}
		}
		return strings.Join(ctx, "")
	}

	highlightEscapeHits := func(msg chat1.UIMessage, hits []string) string {
		if msg.IsValid() && msg.GetMessageType() == chat1.MessageType_TEXT {
			msgBody := msg.Valid().MessageBody.Text().Body
			escapedHitText := terminalescaper.Clean(msgBody)
			for _, hit := range hits {
				escapedHit := terminalescaper.Clean(hit)
				escapedHitText = strings.Replace(escapedHitText, escapedHit, ColorString(c.G(), "red", escapedHit), -1)
			}
			return terminalescaper.Clean(getMsgPrefix(msg)) + escapedHitText
		}
		return ""
	}

	// TODO: This should really use chat_cli_rendering.messageView, but we need
	// to refactor for UIMessage
	hitTextColoredEscaped := highlightEscapeHits(searchHit.HitMessage, searchHit.Matches)
	if hitTextColoredEscaped != "" {
		c.terminal.Output(getContext(searchHit.BeforeMessages))
		fmt.Fprintln(c.terminal.UnescapedOutputWriter(), hitTextColoredEscaped)
		c.terminal.Output(getContext(searchHit.AfterMessages))
		c.terminal.Output("\n")
	}
	return nil
}

func (c *ChatUI) ChatSearchHit(ctx context.Context, arg chat1.ChatSearchHitArg) error {
	if c.noOutput {
		return nil
	}
	return c.renderSearchHit(ctx, arg.SearchHit)
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

func (c *ChatUI) ChatInboxSearchHit(ctx context.Context, arg chat1.ChatInboxSearchHitArg) error {
	if c.noOutput {
		return nil
	}
	w := c.terminal.OutputWriter()
	searchHit := arg.SearchHit
	fmt.Fprintf(w, "Conversation: %s, found %d results\n", searchHit.ConvName, len(searchHit.Hits))
	for _, hit := range searchHit.Hits {
		if err := c.renderSearchHit(ctx, hit); err != nil {
			return err
		}
	}
	return nil
}

func (c *ChatUI) ChatInboxSearchDone(ctx context.Context, arg chat1.ChatInboxSearchDoneArg) error {
	if c.noOutput {
		return nil
	}
	w := c.terminal.ErrorWriter()
	fmt.Fprintf(w, "Search complete. Found %d results in %d conversations.", arg.NumHits, arg.NumConvs)
	fmt.Fprintln(w, "")
	return nil
}
