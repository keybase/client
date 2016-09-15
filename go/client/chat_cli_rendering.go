package client

import (
	"fmt"
	"math"
	"time"

	humanize "github.com/dustin/go-humanize"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type conversationListView []keybase1.ConversationLocal

// maxWidth must >= 3
func (v conversationListView) renderConversationName(maxWidth int, index int) string {
	if v[index].Info == nil {
		return ""
	}
	name := v[index].Info.TlfName
	if len(v[index].Messages) > 0 && v[index].Messages[0].Info != nil && v[index].Messages[0].Info.IsNew {
		name = "* " + name
	}
	if len(name) > maxWidth {
		name = name[:maxWidth-3] + "..."
	}
	return name
}

func (v conversationListView) show(g *libkb.GlobalContext, ui libkb.TerminalUI) {
	if len(v) == 0 {
		return
	}
	w, _ := ui.TerminalSize()
	iConversation := 0
	ui.TablifyAlignRight(nil, func() []string {
		for ; iConversation < len(v) && len(v[iConversation].Messages) == 0; iConversation++ {
		}
		if iConversation == len(v) {
			return nil
		}
		headings := w/2 - 2 // headings shouldn't exceed half of terminal size
		conversationNumber := fmt.Sprintf("[%d]", iConversation)
		headings -= len(conversationNumber)
		authorAndTime := messageFormatter(v[iConversation].Messages[0]).renderAuthorAndTime()
		headings -= len(authorAndTime)
		if headings < 3 {
			ui.Printf("terminal too small!\n")
			return nil
		}
		conversationName := v.renderConversationName(headings, iConversation)
		ret := []string{
			conversationNumber,
			conversationName,
			authorAndTime,
			// This is actually incorrect since the headings may not take as much as
			// w/2 space, in which case messages should be able to be longer.
			//
			// TODO: need a more beefy tablifier
			messageFormatter(v[iConversation].Messages[0]).renderMessage(g, w-w/2-2),
		}
		iConversation++
		return ret
	})
}

func (v conversationListView) showSummaryOnMore(ui libkb.TerminalUI, totalMore int) {
	for i := len(v) - 1; i >= 0; i-- {
		if len(v[i].Messages) == 0 {
			continue
		}
		days := int(math.Ceil(time.Since(gregor1.FromTime(v[i].Messages[0].ServerHeader.Ctime)).Hours() / 24))
		ui.Printf(" +%d older chats (--time=%dd to see %d more)\n", totalMore, days, len(v))
		return
	}
}

type conversationView keybase1.ConversationLocal

func (v conversationView) show(g *libkb.GlobalContext, ui libkb.TerminalUI) {
	if len(v.Messages) == 0 {
		return
	}
	w, _ := ui.TerminalSize()
	ch := make(chan []string)
	go func() {
		for _, m := range v.Messages {
			unread := ""
			if m.Info.IsNew {
				unread = "*"
			}
			authorAndTime := messageFormatter(m).renderAuthorAndTime()
			rest := w - len(unread) - len(authorAndTime) - 2 /* 2 extra spaces added by tablify */
			if rest < 3 {
				ui.Printf("terminal too small!\n")
				break
			}
			lines := messageFormatter(m).renderMessageWrap(g, rest)
			for i, l := range lines {
				if i == 0 {
					ch <- []string{unread, authorAndTime, lines[0]}
				} else {
					ch <- []string{"", "", l}
				}
			}
		}
		close(ch)
	}()
	// TODO: need better tablifier!
	ui.TablifyAlignRight(nil, func() []string {
		return <-ch
	})
}

type messageFormatter keybase1.Message

func (f messageFormatter) renderAuthorAndTime() string {
	info := keybase1.Message(f).Info
	if info == nil {
		return "[] "
	}
	t := gregor1.FromTime(keybase1.Message(f).ServerHeader.Ctime)
	// extra space to get around right aligned tab writer
	return fmt.Sprintf("[%s (%s) %s] ", info.SenderUsername, info.SenderDeviceName, humanize.Time(t))
}

func (f messageFormatter) body(g *libkb.GlobalContext) []string {
	version, err := f.MessagePlaintext.Version()
	if err != nil {
		g.Log.Warning("MessagePlaintext version error: %s", err)
		return nil
	}
	switch version {
	case keybase1.MessagePlaintextVersion_V1:
		body := f.MessagePlaintext.V1().MessageBody
		typ, err := body.MessageType()
		if err != nil {
			return nil
		}
		switch typ {
		case chat1.MessageType_TEXT:
			return []string{body.Text().Body}
		case chat1.MessageType_ATTACHMENT:
			return []string{"{Attachment}", "Caption: <unimplemented>", fmt.Sprintf("KBFS: %s", body.Attachment().Path)}
		default:
			return []string{fmt.Sprintf("unsupported MessageType: %s", typ.String())}
		}
	default:
		g.Log.Warning("messageFormatter.body unhandled MessagePlaintext version %v", version)
		return nil
	}
}

// maxWidth must >= 3
func (f messageFormatter) renderMessage(g *libkb.GlobalContext, maxWidth int) string {
	lines := f.body(g)
	if len(lines) == 0 {
		return ""
	}
	if len(lines[0]) > maxWidth {
		return lines[0][:maxWidth-3] + "..."
	}
	return lines[0]
}

// maxWidth must > 0
func (f messageFormatter) renderMessageWrap(g *libkb.GlobalContext, maxWidth int) (lines []string) {
	bodyLines := f.body(g)
	for _, b := range bodyLines {
		for len(b) > maxWidth {
			lines = append(lines, b[:maxWidth])
			b = b[maxWidth:]
		}
		lines = append(lines, b)
	}
	return lines
}
