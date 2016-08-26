package client

import (
	"fmt"

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

func (v conversationListView) show(ui libkb.TerminalUI) {
	if len(v) == 0 {
		return
	}
	iConversation := 0
	ui.TablifyAlignRight(nil, func() []string {
		for ; iConversation < len(v) && len(v[iConversation].Messages) == 0; iConversation++ {
		}
		if iConversation == len(v) {
			return nil
		}
		ret := []string{
			fmt.Sprintf("[%d]", iConversation),
			v.renderConversationName(20, iConversation),
			messageFormatter(v[iConversation].Messages[0]).renderAuthorAndTime(),
			messageFormatter(v[iConversation].Messages[0]).renderMessage(40),
		}
		iConversation++
		return ret
	})
}

type conversationView keybase1.ConversationLocal

func (v conversationView) show(ui libkb.TerminalUI) {
	if len(v.Messages) == 0 {
		return
	}
	ch := make(chan []string)
	go func() {
		for _, m := range v.Messages {
			unread := ""
			if m.Info.IsNew {
				unread = "*"
			}
			authorAndTime := messageFormatter(m).renderAuthorAndTime()
			lines := messageFormatter(m).renderMessageWrap(60)
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

func (f messageFormatter) body() []string {
	bodies := keybase1.Message(f).MessagePlaintext.MessageBodies
	if len(bodies) == 0 {
		return nil
	}
	switch t := bodies[0].Type; t {
	case chat1.MessageType_TEXT:
		return []string{bodies[0].Text.Body}
	case chat1.MessageType_ATTACHMENT:
		return []string{"{Attachment}", "Caption: <unimplemented>", fmt.Sprintf("KBFS: %s", bodies[0].Attachment.Path)}
	default:
		return []string{fmt.Sprintf("unsupported MessageType: %s", t.String())}
	}
}

// maxWidth must >= 3
func (f messageFormatter) renderMessage(maxWidth int) string {
	lines := f.body()
	if len(lines) == 0 {
		return ""
	}
	if len(lines[0]) > maxWidth {
		return lines[0][:maxWidth-3] + "..."
	}
	return lines[0]
}

// maxWidth must > 0
func (f messageFormatter) renderMessageWrap(maxWidth int) (lines []string) {
	bodyLines := f.body()
	for _, b := range bodyLines {
		for len(b) > maxWidth {
			lines = append(lines, b[:maxWidth])
			b = b[maxWidth:]
		}
		lines = append(lines, b)
	}
	return lines
}
