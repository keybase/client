package client

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/keybase/client/go/flexibleTable"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type conversationListView []chat1.ConversationLocal

func (v conversationListView) show(g *libkb.GlobalContext, ui libkb.TerminalUI) {
	if len(v) == 0 {
		return
	}
	w, _ := ui.TerminalSize()

	table := &flexibleTable.Table{}
	for i, conv := range v {
		unread := ""
		if conv.Messages[0].Info.IsNew {
			unread = "*"
		}
		participants := strings.Split(conv.Info.TlfName, ",")
		authorAndTime := messageFormatter(conv.Messages[0]).authorAndTime()
		body, err := messageFormatter(conv.Messages[0]).body(g)
		if err != nil {
			ui.Printf("rendering message body error: %v\n", err)
		}

		table.Insert(flexibleTable.Row{
			flexibleTable.Cell{
				Frame:     [2]string{"[", "]"},
				Alignment: flexibleTable.Right,
				Content:   flexibleTable.SingleCell{Item: strconv.Itoa(i + 1)},
			},
			flexibleTable.Cell{
				Alignment: flexibleTable.Center,
				Content:   flexibleTable.SingleCell{Item: unread},
			},
			flexibleTable.Cell{
				Alignment: flexibleTable.Left,
				Content:   flexibleTable.MultiCell{Sep: ",", Items: participants},
			},
			flexibleTable.Cell{
				Frame:     [2]string{"[", "]"},
				Alignment: flexibleTable.Right,
				Content:   flexibleTable.SingleCell{Item: authorAndTime},
			},
			flexibleTable.Cell{
				Alignment: flexibleTable.Left,
				Content:   flexibleTable.SingleCell{Item: body},
			},
		})
	}
	if err := table.Render(ui.OutputWriter(), " ", w, []flexibleTable.ColumnConstraint{
		5, 1, 20, 20, flexibleTable.Expandable,
	}); err != nil {
		ui.Printf("rendering conversation list view error: %v\n", err)
	}
}

type conversationView chat1.ConversationLocal

func (v conversationView) show(g *libkb.GlobalContext, ui libkb.TerminalUI) {
	if len(v.Messages) == 0 {
		return
	}
	w, _ := ui.TerminalSize()
	table := &flexibleTable.Table{}
	for i, m := range v.Messages {
		unread := ""
		if m.Info.IsNew {
			unread = "*"
		}
		authorAndTime := messageFormatter(m).authorAndTime()
		body, err := messageFormatter(m).body(g)
		if err != nil {
			ui.Printf("rendering message body error: %v\n", err)
		}

		table.Insert(flexibleTable.Row{
			flexibleTable.Cell{
				Frame:     [2]string{"[", "]"},
				Alignment: flexibleTable.Right,
				Content:   flexibleTable.SingleCell{Item: strconv.Itoa(i + 1)},
			},
			flexibleTable.Cell{
				Alignment: flexibleTable.Center,
				Content:   flexibleTable.SingleCell{Item: unread},
			},
			flexibleTable.Cell{
				Frame:     [2]string{"[", "]"},
				Alignment: flexibleTable.Right,
				Content:   flexibleTable.SingleCell{Item: authorAndTime},
			},
			flexibleTable.Cell{
				Alignment: flexibleTable.Left,
				Content:   flexibleTable.SingleCell{Item: body},
			},
		})
	}
	if err := table.Render(ui.OutputWriter(), " ", w, []flexibleTable.ColumnConstraint{
		5, 1, 20, flexibleTable.ExpandableWrappable,
	}); err != nil {
		ui.Printf("rendering conversation view error: %v\n", err)
	}
}

type messageFormatter chat1.Message

func (f messageFormatter) authorAndTime() string {
	info := chat1.Message(f).Info
	if info == nil {
		return ""
	}
	t := gregor1.FromTime(chat1.Message(f).ServerHeader.Ctime)
	return fmt.Sprintf("%s %s", info.SenderUsername, shortDurationFromNow(t))
}

func (f messageFormatter) body(g *libkb.GlobalContext) (string, error) {
	version, err := f.MessagePlaintext.Version()
	if err != nil {
		g.Log.Warning("MessagePlaintext version error: %s", err)
		return "", err
	}
	switch version {
	case chat1.MessagePlaintextVersion_V1:
		body := f.MessagePlaintext.V1().MessageBody
		typ, err := body.MessageType()
		if err != nil {
			return "", err
		}
		switch typ {
		case chat1.MessageType_TEXT:
			return body.Text().Body, nil
		case chat1.MessageType_ATTACHMENT:
			return fmt.Sprintf("{Attachment} | Caption: <unimplemented> | KBFS: %s", body.Attachment().Path), nil
		default:
			return fmt.Sprintf("unsupported MessageType: %s", typ.String()), nil
		}
	default:
		g.Log.Warning("messageFormatter.body unhandled MessagePlaintext version %v", version)
		return "", err
	}
}

func shortDurationFromNow(t time.Time) string {
	d := time.Now().Sub(t)

	num := d.Hours() / 24
	if num > 1 {
		return strconv.Itoa(int(math.Ceil(num))) + "d"
	}

	num = d.Hours()
	if num > 1 {
		return strconv.Itoa(int(math.Ceil(num))) + "h"
	}

	num = d.Minutes()
	if num > 1 {
		return strconv.Itoa(int(math.Ceil(num))) + "m"
	}

	num = d.Seconds()
	return strconv.Itoa(int(math.Ceil(num))) + "s"
}
