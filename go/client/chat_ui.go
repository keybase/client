// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"golang.org/x/net/context"

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
