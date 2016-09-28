package client

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/keybase/client/go/flexibletable"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type conversationInfoListView []chat1.ConversationInfoLocal

func (v conversationInfoListView) show(g *libkb.GlobalContext) error {
	if len(v) == 0 {
		return nil
	}

	ui := g.UI.GetTerminalUI()
	w, _ := ui.TerminalSize()

	table := &flexibletable.Table{}
	for i, conv := range v {
		participants := strings.Split(conv.TlfName, ",")
		table.Insert(flexibletable.Row{
			flexibletable.Cell{
				Frame:     [2]string{"[", "]"},
				Alignment: flexibletable.Right,
				Content:   flexibletable.SingleCell{Item: strconv.Itoa(i + 1)},
			},
			flexibletable.Cell{
				Alignment: flexibletable.Left,
				Content:   flexibletable.MultiCell{Sep: ",", Items: participants},
			},
		})
	}
	if err := table.Render(ui.OutputWriter(), " ", w, []flexibletable.ColumnConstraint{
		5, flexibletable.ExpandableWrappable,
	}); err != nil {
		return fmt.Errorf("rendering conversation info list view error: %v\n", err)
	}

	return nil
}

type conversationListView []chat1.ConversationLocal

func (v conversationListView) show(g *libkb.GlobalContext, myUsername string, showDeviceName bool) error {
	if len(v) == 0 {
		return nil
	}

	ui := g.UI.GetTerminalUI()
	w, _ := ui.TerminalSize()

	table := &flexibletable.Table{}
	for i, conv := range v {
		unread := ""
		if conv.Messages[0].Info.IsNew {
			unread = "*"
		}

		participants := strings.Split(conv.Info.TlfName, ",")
		if len(participants) > 1 {
			var withoutMe []string
			for _, p := range participants {
				if p != myUsername {
					withoutMe = append(withoutMe, p)
				}
			}
			participants = withoutMe
		}

		authorAndTime := messageFormatter(conv.Messages[0]).authorAndTime(showDeviceName)
		body, err := messageFormatter(conv.Messages[0]).body(g)
		if err != nil {
			return fmt.Errorf("rendering message body error: %v\n", err)
		}

		table.Insert(flexibletable.Row{
			flexibletable.Cell{
				Frame:     [2]string{"[", "]"},
				Alignment: flexibletable.Right,
				Content:   flexibletable.SingleCell{Item: strconv.Itoa(i + 1)},
			},
			flexibletable.Cell{
				Alignment: flexibletable.Center,
				Content:   flexibletable.SingleCell{Item: unread},
			},
			flexibletable.Cell{
				Alignment: flexibletable.Left,
				Content:   flexibletable.MultiCell{Sep: ",", Items: participants},
			},
			flexibletable.Cell{
				Frame:     [2]string{"[", "]"},
				Alignment: flexibletable.Right,
				Content:   flexibletable.SingleCell{Item: authorAndTime},
			},
			flexibletable.Cell{
				Alignment: flexibletable.Left,
				Content:   flexibletable.SingleCell{Item: body},
			},
		})
	}
	if err := table.Render(ui.OutputWriter(), " ", w, []flexibletable.ColumnConstraint{
		5, 1, flexibletable.ColumnConstraint(w / 4), flexibletable.ColumnConstraint(w / 4), flexibletable.Expandable,
	}); err != nil {
		return fmt.Errorf("rendering conversation list view error: %v\n", err)
	}

	return nil
}

type conversationView chat1.ConversationLocal

func (v conversationView) show(g *libkb.GlobalContext, showDeviceName bool) error {
	if len(v.Messages) == 0 {
		return nil
	}

	ui := g.UI.GetTerminalUI()
	w, _ := ui.TerminalSize()

	table := &flexibletable.Table{}
	for i, m := range v.Messages {
		unread := ""
		if m.Info.IsNew {
			unread = "*"
		}
		authorAndTime := messageFormatter(m).authorAndTime(showDeviceName)
		body, err := messageFormatter(m).body(g)
		if err != nil {
			return fmt.Errorf("rendering message body error: %v\n", err)
		}

		table.Insert(flexibletable.Row{
			flexibletable.Cell{
				Frame:     [2]string{"[", "]"},
				Alignment: flexibletable.Right,
				Content:   flexibletable.SingleCell{Item: strconv.Itoa(i + 1)},
			},
			flexibletable.Cell{
				Alignment: flexibletable.Center,
				Content:   flexibletable.SingleCell{Item: unread},
			},
			flexibletable.Cell{
				Frame:     [2]string{"[", "]"},
				Alignment: flexibletable.Right,
				Content:   flexibletable.SingleCell{Item: authorAndTime},
			},
			flexibletable.Cell{
				Alignment: flexibletable.Left,
				Content:   flexibletable.SingleCell{Item: body},
			},
		})
	}
	if err := table.Render(ui.OutputWriter(), " ", w, []flexibletable.ColumnConstraint{
		5, 1, flexibletable.ColumnConstraint(w / 4), flexibletable.ExpandableWrappable,
	}); err != nil {
		return fmt.Errorf("rendering conversation view error: %v\n", err)
	}

	return nil
}

type messageFormatter chat1.Message

func (f messageFormatter) authorAndTime(showDeviceName bool) string {
	info := chat1.Message(f).Info
	if info == nil {
		return ""
	}
	t := gregor1.FromTime(chat1.Message(f).ServerHeader.Ctime)
	if showDeviceName {
		return fmt.Sprintf("%s <%s> %s", info.SenderUsername, info.SenderDeviceName, shortDurationFromNow(t))
	}
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
	d := time.Since(t)

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
