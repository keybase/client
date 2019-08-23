// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"fmt"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/terminalescaper"
)

type ChatCLINotifications struct {
	libkb.Contextified
	chat1.NotifyChatInterface
	noOutput              bool
	terminal              libkb.TerminalUI
	lastAttachmentPercent int
}

func NewChatCLINotifications(g *libkb.GlobalContext) *ChatCLINotifications {
	return &ChatCLINotifications{
		Contextified: libkb.NewContextified(g),
		terminal:     g.UI.GetTerminalUI(),
	}
}

func (n *ChatCLINotifications) ChatAttachmentUploadStart(ctx context.Context,
	arg chat1.ChatAttachmentUploadStartArg) error {
	if n.noOutput {
		return nil
	}
	w := n.terminal.ErrorWriter()
	fmt.Fprintf(w, "Attachment upload "+ColorString(n.G(), "green", "starting")+"\n")
	return nil
}

func (n *ChatCLINotifications) ChatAttachmentUploadProgress(ctx context.Context,
	arg chat1.ChatAttachmentUploadProgressArg) error {
	if n.noOutput {
		return nil
	}
	percent := int((100 * arg.BytesComplete) / arg.BytesTotal)
	if n.lastAttachmentPercent == 0 || percent == 100 || percent-n.lastAttachmentPercent >= 10 {
		w := n.terminal.ErrorWriter()
		fmt.Fprintf(w, "Attachment upload progress %d%% (%d of %d bytes uploaded)\n", percent, arg.BytesComplete, arg.BytesTotal)
		n.lastAttachmentPercent = percent
	}
	return nil
}

type ChatCLIUI struct {
	libkb.Contextified
	terminal libkb.TerminalUI
	noOutput bool
	// if we delegate the inbox search to the thread searcher, we don't want to
	// duplicate output.
	noThreadSearch                          bool
	lastAttachmentPercent, lastIndexPercent int
}

func NewChatCLIUI(g *libkb.GlobalContext) *ChatCLIUI {
	return &ChatCLIUI{
		Contextified: libkb.NewContextified(g),
		terminal:     g.UI.GetTerminalUI(),
	}
}

func (c *ChatCLIUI) ChatAttachmentDownloadStart(context.Context, int) error {
	if c.noOutput {
		return nil
	}
	w := c.terminal.ErrorWriter()
	fmt.Fprintf(w, "Attachment download "+ColorString(c.G(), "green", "starting")+"\n")
	return nil
}

func (c *ChatCLIUI) ChatAttachmentDownloadProgress(ctx context.Context, arg chat1.ChatAttachmentDownloadProgressArg) error {
	if c.noOutput {
		return nil
	}
	percent := int((100 * arg.BytesComplete) / arg.BytesTotal)
	if c.lastAttachmentPercent == 0 || percent == 100 || percent-c.lastAttachmentPercent >= 10 {
		w := c.terminal.ErrorWriter()
		fmt.Fprintf(w, "Attachment download progress %d%% (%d of %d bytes downloaded)\n", percent, arg.BytesComplete, arg.BytesTotal)
		c.lastAttachmentPercent = percent
	}
	return nil
}

func (c *ChatCLIUI) ChatAttachmentDownloadDone(context.Context, int) error {
	if c.noOutput {
		return nil
	}
	w := c.terminal.ErrorWriter()
	fmt.Fprintf(w, "Attachment download "+ColorString(c.G(), "magenta", "finished")+"\n")
	return nil
}

func (c *ChatCLIUI) ChatInboxConversation(ctx context.Context, arg chat1.ChatInboxConversationArg) error {
	return nil
}

func (c *ChatCLIUI) ChatInboxFailed(ctx context.Context, arg chat1.ChatInboxFailedArg) error {
	return nil
}

func (c *ChatCLIUI) ChatInboxUnverified(ctx context.Context, arg chat1.ChatInboxUnverifiedArg) error {
	return nil
}

func (c *ChatCLIUI) ChatThreadCached(ctx context.Context, arg chat1.ChatThreadCachedArg) error {
	return nil
}

func (c *ChatCLIUI) ChatThreadFull(ctx context.Context, arg chat1.ChatThreadFullArg) error {
	return nil
}

func (c *ChatCLIUI) ChatThreadStatus(ctx context.Context, arg chat1.ChatThreadStatusArg) error {
	return nil
}

func (c *ChatCLIUI) ChatConfirmChannelDelete(ctx context.Context, arg chat1.ChatConfirmChannelDeleteArg) (bool, error) {
	term := c.G().UI.GetTerminalUI()
	term.Printf("WARNING: This will destroy this chat channel and remove it from all members' inbox\n\n")
	confirm := fmt.Sprintf("nuke %s", arg.Channel)
	response, err := term.Prompt(PromptDescriptorDeleteRootTeam,
		fmt.Sprintf("** if you are sure, please type: %q > ", confirm))
	if err != nil {
		return false, err
	}
	return response == confirm, nil
}

func (c *ChatCLIUI) renderSearchHit(ctx context.Context, searchHit chat1.ChatSearchHit) error {
	getMsgPrefix := func(msg chat1.UIMessage) string {
		m := msg.Valid()
		t := gregor1.FromTime(m.Ctime)
		return fmt.Sprintf("[%s %s] ", m.SenderUsername, shortDurationFromNow(t))
	}

	getContext := func(msgs []chat1.UIMessage) string {
		ctx := []string{}
		for _, msg := range msgs {
			msgText := msg.SearchableText()
			if msgText != "" {
				ctx = append(ctx, getMsgPrefix(msg)+msgText+"\n")
			}
		}
		return strings.Join(ctx, "")
	}

	highlightEscapeHits := func(msg chat1.UIMessage, hits []chat1.ChatSearchMatch) string {
		colorStrOffset := len(ColorString(c.G(), "red", ""))
		totalOffset := 0
		msgText := msg.SearchableText()
		if msgText != "" {
			escapedHitText := terminalescaper.Clean(msgText)
			for _, hit := range hits {
				escapedHit := terminalescaper.Clean(hit.Match)
				i := totalOffset + hit.StartIndex
				j := totalOffset + hit.EndIndex
				if i > len(escapedHitText) || j > len(escapedHitText) {
					// sanity check string indices
					continue
				}
				// Splice the match into the result with a color highlight. We
				// can't do a direct string replacement since the match might
				// be a substring of the color text.
				escapedHitText = escapedHitText[:i] + ColorString(c.G(), "red", escapedHit) + escapedHitText[j:]
				totalOffset += colorStrOffset
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

func (c *ChatCLIUI) ChatSearchHit(ctx context.Context, arg chat1.ChatSearchHitArg) error {
	if c.noOutput || c.noThreadSearch {
		return nil
	}
	return c.renderSearchHit(ctx, arg.SearchHit)
}

func (c *ChatCLIUI) simplePlural(count int, prefix string) string {
	if count == 1 {
		return prefix
	}
	return fmt.Sprintf("%ss", prefix)
}

func (c *ChatCLIUI) ChatSearchDone(ctx context.Context, arg chat1.ChatSearchDoneArg) error {
	if c.noOutput || c.noThreadSearch {
		return nil
	}
	w := c.terminal.ErrorWriter()
	numHits := arg.NumHits
	if numHits == 0 {
		fmt.Fprintf(w, "Search complete. No results found.\n")
	} else {
		fmt.Fprintf(w, "Search complete. Found %d %s.\n", numHits, c.simplePlural(numHits, "result"))
	}
	return nil
}

func (c *ChatCLIUI) ChatSearchInboxHit(ctx context.Context, arg chat1.ChatSearchInboxHitArg) error {
	if c.noOutput {
		return nil
	}
	w := c.terminal.OutputWriter()
	searchHit := arg.SearchHit
	numHits := len(searchHit.Hits)
	if numHits == 0 {
		return nil
	}
	fmt.Fprintf(w, "Conversation: %s, found %d %s.\n", searchHit.ConvName, numHits, c.simplePlural(numHits, "result"))
	for _, hit := range searchHit.Hits {
		if err := c.renderSearchHit(ctx, hit); err != nil {
			return err
		}
	}
	// Separate results in conversations.
	width, _ := c.terminal.TerminalSize()
	if width > 80 {
		width = 80
	}
	fmt.Fprintf(w, fmt.Sprintf("%s\n", strings.Repeat("-", width)))
	return nil
}

func (c *ChatCLIUI) ChatSearchInboxDone(ctx context.Context, arg chat1.ChatSearchInboxDoneArg) error {
	if c.noOutput {
		return nil
	}
	w := c.terminal.ErrorWriter()
	numHits := arg.Res.NumHits
	if numHits == 0 {
		fmt.Fprintf(w, "Search complete. No results found.\n")
	} else {
		searchText := fmt.Sprintf("Search complete. Found %d %s", numHits, c.simplePlural(numHits, "result"))
		numConvs := arg.Res.NumConvs
		searchText = fmt.Sprintf("%s in %d %s.\n", searchText, numConvs, c.simplePlural(numConvs, "conversation"))
		fmt.Fprintf(w, searchText)
	}
	if !arg.Res.Delegated {
		percentIndexed := arg.Res.PercentIndexed
		helpText := ""
		if percentIndexed < 70 {
			helpText = "Rerun with --force-reindex for more complete results."
		}
		fmt.Fprintf(w, "Indexing was %d%% complete. %s\n", percentIndexed, helpText)
	}
	return nil
}

func (c *ChatCLIUI) ChatSearchInboxStart(ctx context.Context, sessionID int) error {
	return nil
}

func (c *ChatCLIUI) ChatSearchIndexStatus(ctx context.Context, arg chat1.ChatSearchIndexStatusArg) error {
	if c.noOutput {
		return nil
	}
	if percentIndexed := arg.Status.PercentIndexed; percentIndexed > c.lastIndexPercent {
		c.terminal.Output(fmt.Sprintf("Indexing: %d%%.\n", percentIndexed))
		c.lastIndexPercent = percentIndexed
	}
	return nil
}

func (c *ChatCLIUI) ChatSearchConvHits(ctx context.Context, arg chat1.ChatSearchConvHitsArg) error {
	if c.noOutput {
		return nil
	}
	for _, hit := range arg.Hits.Hits {
		c.terminal.Output(fmt.Sprintf("Conversation: %s found with matching name\n", hit.Name))
	}
	return nil
}

func (c *ChatCLIUI) ChatStellarShowConfirm(ctx context.Context, sessionID int) error {
	return nil
}

func (c *ChatCLIUI) ChatStellarDataConfirm(ctx context.Context, arg chat1.ChatStellarDataConfirmArg) (bool, error) {
	term := c.G().UI.GetTerminalUI()
	term.Printf("Confirm Stellar Payments:\n\n")
	term.Printf("Total: %s (%s)\n", arg.Summary.XlmTotal, arg.Summary.DisplayTotal)
	for _, p := range arg.Summary.Payments {
		if p.Error != nil {
			term.Printf("Payment Error: %s\n", *p.Error)
		} else {
			out := fmt.Sprintf("-> %s %s", p.Username, p.XlmAmount)
			if p.DisplayAmount != nil {
				out += fmt.Sprintf(" (%s)", *p.DisplayAmount)
			}
			term.Printf(out + "\n")
		}
	}
	confirm := "sendmoney"
	response, err := term.Prompt(PromptDescriptorStellarConfirm,
		fmt.Sprintf("** if you are sure, please type: %q > ", confirm))
	if err != nil {
		return false, err
	}
	return strings.TrimSpace(response) == confirm, nil
}

func (c *ChatCLIUI) ChatStellarDataError(ctx context.Context, arg chat1.ChatStellarDataErrorArg) (bool, error) {
	w := c.terminal.ErrorWriter()
	msg := "Failed to obtain Stellar payment information, aborting send"
	fmt.Fprintf(w, msg+"\n")
	return false, errors.New(msg)
}

func (c *ChatCLIUI) ChatStellarDone(ctx context.Context, arg chat1.ChatStellarDoneArg) error {
	return nil
}

func (c *ChatCLIUI) ChatGiphySearchResults(ctx context.Context, arg chat1.ChatGiphySearchResultsArg) error {
	return nil
}

func (c *ChatCLIUI) ChatGiphyToggleResultWindow(ctx context.Context, arg chat1.ChatGiphyToggleResultWindowArg) error {
	return nil
}

func (c *ChatCLIUI) ChatShowManageChannels(ctx context.Context, arg chat1.ChatShowManageChannelsArg) error {
	return nil
}

func (c *ChatCLIUI) ChatCoinFlipStatus(ctx context.Context, arg chat1.ChatCoinFlipStatusArg) error {
	return nil
}

func (c *ChatCLIUI) ChatCommandMarkdown(ctx context.Context, arg chat1.ChatCommandMarkdownArg) error {
	return nil
}

func (c *ChatCLIUI) ChatMaybeMentionUpdate(ctx context.Context, arg chat1.ChatMaybeMentionUpdateArg) error {
	return nil
}

func (c *ChatCLIUI) ChatLoadGalleryHit(ctx context.Context, arg chat1.ChatLoadGalleryHitArg) error {
	return nil
}

func (c *ChatCLIUI) ChatWatchPosition(context.Context, chat1.ChatWatchPositionArg) (chat1.LocationWatchID, error) {
	return chat1.LocationWatchID(0), nil
}

func (c *ChatCLIUI) ChatClearWatch(context.Context, chat1.ChatClearWatchArg) error {
	return nil
}

func (c *ChatCLIUI) ChatCommandStatus(context.Context, chat1.ChatCommandStatusArg) error {
	return nil
}

func (c *ChatCLIUI) ChatBotCommandsUpdateStatus(context.Context, chat1.ChatBotCommandsUpdateStatusArg) error {
	return nil
}
