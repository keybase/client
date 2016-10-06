package client

import (
	"errors"
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

		if conv.Error != nil {
			table.Insert(flexibletable.Row{
				flexibletable.Cell{
					Frame:     [2]string{"[", "]"},
					Alignment: flexibletable.Right,
					Content:   flexibletable.SingleCell{Item: strconv.Itoa(i + 1)},
				},
				flexibletable.Cell{
					Alignment: flexibletable.Center,
					Content:   flexibletable.SingleCell{Item: ""},
				},
				flexibletable.Cell{
					Alignment: flexibletable.Left,
					Content:   flexibletable.SingleCell{Item: "???"},
				},
				flexibletable.Cell{
					Frame:     [2]string{"[", "]"},
					Alignment: flexibletable.Right,
					Content:   flexibletable.SingleCell{Item: "???"},
				},
				flexibletable.Cell{
					Alignment: flexibletable.Left,
					Content:   flexibletable.SingleCell{Item: *conv.Error},
				},
			})
			continue
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

		unread := "*"
		var msg chat1.MessageFromServerOrError
		for _, m := range conv.MaxMessages {
			if m.Message != nil {
				if conv.ReaderInfo.ReadMsgid == m.Message.ServerHeader.MessageID {
					unread = ""
				}
				if m.Message.ServerHeader.MessageType == chat1.MessageType_TEXT {
					msg = m
				}
			}
		}

		authorAndTime := messageFormatter(msg).authorAndTime(showDeviceName)
		body, err := messageFormatter(msg).body(g)
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

type conversationView struct {
	conversation chat1.ConversationLocal
	messages     []chat1.MessageFromServerOrError
}

func (v conversationView) show(g *libkb.GlobalContext, showDeviceName bool) error {
	if len(v.messages) == 0 {
		return nil
	}

	ui := g.UI.GetTerminalUI()
	w, _ := ui.TerminalSize()

	table := &flexibletable.Table{}
	for i, m := range v.messages {
		unread := ""
		if m.Message != nil &&
			v.conversation.ReaderInfo.ReadMsgid < m.Message.ServerHeader.MessageID {
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

type messageFormatter chat1.MessageFromServerOrError

func (f messageFormatter) authorAndTime(showDeviceName bool) string {
	m := chat1.MessageFromServerOrError(f)
	if m.Message == nil {
		return ""
	}
	t := gregor1.FromTime(m.Message.ServerHeader.Ctime)
	if showDeviceName {
		return fmt.Sprintf("%s <%s> %s", m.Message.SenderUsername, m.Message.SenderDeviceName, shortDurationFromNow(t))
	}
	return fmt.Sprintf("%s %s", m.Message.SenderUsername, shortDurationFromNow(t))
}

func (f messageFormatter) body(g *libkb.GlobalContext) (string, error) {
	m := chat1.MessageFromServerOrError(f)
	if m.Message != nil {
		version, err := m.Message.MessagePlaintext.Version()
		if err != nil {
			g.Log.Warning("MessagePlaintext version error: %s", err)
			return "", err
		}
		switch version {
		case chat1.MessagePlaintextVersion_V1:
			body := m.Message.MessagePlaintext.V1().MessageBody
			typ, err := body.MessageType()
			if err != nil {
				return "", err
			}
			switch typ {
			case chat1.MessageType_TEXT:
				return body.Text().Body, nil
			case chat1.MessageType_ATTACHMENT:
				// TODO: will fix this in CORE-3899
				return "{Attachment} | Caption: <unimplemented>", nil
			default:
				return fmt.Sprintf("unsupported MessageType: %s", typ.String()), nil
			}
		default:
			g.Log.Warning("messageFormatter.body unhandled MessagePlaintext version %v", version)
			return "", err
		}
	}

	if m.UnboxingError != nil {
		return fmt.Sprintf("<%s>", *m.UnboxingError), nil
	}

	return "", errors.New("unexpected data")
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
