package client

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"golang.org/x/net/context"

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
		// show the last TEXT message
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

		mv, err := newMessageView(g, conv.Info.Id, msg)
		if err != nil {
			g.Log.Error("Message render error: %s", err)
		}

		var authorAndTime string
		if showDeviceName {
			authorAndTime = mv.AuthorAndTimeWithDeviceName
		} else {
			authorAndTime = mv.AuthorAndTime
		}

		// This will show a blank link for convs whose last message cannot be displayed.
		body := ""
		if mv.Renderable {
			body = mv.Body
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
	i := -1
	for _, m := range v.messages {
		mv, err := newMessageView(g, v.conversation.Info.Id, m)
		if err != nil {
			g.Log.Error("Message render error: %s", err)
		}

		if !mv.Renderable {
			continue
		}

		unread := ""
		if m.Message != nil &&
			v.conversation.ReaderInfo.ReadMsgid < m.Message.ServerHeader.MessageID {
			unread = "*"
		}

		var authorAndTime string
		if showDeviceName {
			authorAndTime = mv.AuthorAndTimeWithDeviceName
		} else {
			authorAndTime = mv.AuthorAndTime
		}

		i++
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
				Content:   flexibletable.SingleCell{Item: mv.Body},
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

// TODO what is this doing here?
func fetchOneMessage(g *libkb.GlobalContext, conversationID chat1.ConversationID, messageID chat1.MessageID) (chat1.MessageFromServerOrError, error) {
	deflt := chat1.MessageFromServerOrError{}

	chatClient, err := GetChatLocalClient(g)
	if err != nil {
		return deflt, err
	}

	arg := chat1.GetMessagesLocalArg{
		ConversationID: conversationID,
		MessageIDs:     []chat1.MessageID{messageID},
	}
	res, err := chatClient.GetMessagesLocal(context.TODO(), arg)
	if err != nil {
		return deflt, err
	}
	if len(res.Messages) < 0 {
		return deflt, fmt.Errorf("empty messages list")
	}
	return res.Messages[0], nil
}

const deletedTextCLI = "[deleted]"

// Everything you need to show a message.
// Takes into account superseding edits and deletions.
type messageView struct {
	MessageID chat1.MessageID
	// Whether to show this message. Show texts, but not edits or deletes.
	Renderable                  bool
	AuthorAndTime               string
	AuthorAndTimeWithDeviceName string
	Body                        string

	// Used internally for supersedeers
	messageType chat1.MessageType
}

// newMessageView extracts from a message the parts for display
// It may fetch the superseding message. So that for example a TEXT message will show its EDIT text.
func newMessageView(g *libkb.GlobalContext, conversationID chat1.ConversationID, m chat1.MessageFromServerOrError) (messageView, error) {
	mv := messageView{}

	if m.Message == nil {
		if m.UnboxingError != nil {
			return mv, fmt.Errorf(fmt.Sprintf("<%s>", *m.UnboxingError))
		}
		return mv, fmt.Errorf("unexpected data")
	}

	mv.MessageID = m.Message.ServerHeader.MessageID

	// Check what message supersedes this one.
	var mvsup *messageView
	supersededBy := m.Message.ServerHeader.SupersededBy
	if supersededBy != 0 {
		msup, err := fetchOneMessage(g, conversationID, supersededBy)
		if err != nil {
			return mv, err
		}
		mvsupInner, err := newMessageView(g, conversationID, msup)
		if err != nil {
			return mv, err
		}
		mvsup = &mvsupInner
	}

	t := gregor1.FromTime(m.Message.ServerHeader.Ctime)
	mv.AuthorAndTime = fmt.Sprintf("%s %s",
		m.Message.SenderUsername, shortDurationFromNow(t))
	mv.AuthorAndTimeWithDeviceName = fmt.Sprintf("%s <%s> %s",
		m.Message.SenderUsername, m.Message.SenderDeviceName, shortDurationFromNow(t))

	version, err := m.Message.MessagePlaintext.Version()
	if err != nil {
		g.Log.Warning("MessagePlaintext version error: %s", err)
		return mv, err
	}
	switch version {
	case chat1.MessagePlaintextVersion_V1:
		plaintext := m.Message.MessagePlaintext.V1()
		body := plaintext.MessageBody
		typ, err := plaintext.MessageBody.MessageType()
		mv.messageType = typ
		if err != nil {
			return mv, err
		}
		switch typ {
		case chat1.MessageType_NONE:
			// NONE is what you get when a message has been deleted.
			mv.Renderable = true
			if mvsup != nil {
				switch mvsup.messageType {
				case chat1.MessageType_EDIT:
					// Use the edited body
					mv.Body = mvsup.Body
				case chat1.MessageType_DELETE:
					mv.Body = deletedTextCLI
				default:
					// Some unknown supersedeer type
				}
			}
		case chat1.MessageType_TEXT:
			mv.Renderable = true
			mv.Body = body.Text().Body
			if mvsup != nil {
				switch mvsup.messageType {
				case chat1.MessageType_EDIT:
					mv.Body = mvsup.Body
				case chat1.MessageType_DELETE:
					// This is unlikely because deleted messages are usually NONE
					mv.Body = deletedTextCLI
				default:
					// Some unknown supersedeer type
				}
			}
		case chat1.MessageType_ATTACHMENT:
			mv.Renderable = true
			// TODO: will fix this in CORE-3899
			mv.Body = fmt.Sprintf("{Attachment} | Caption: <unimplemented>")
			if mvsup != nil {
				switch mvsup.messageType {
				case chat1.MessageType_EDIT:
					// Editing attachments is not supported, ignore the edit
				case chat1.MessageType_DELETE:
					mv.Body = deletedTextCLI
				default:
					// Some unknown supersedeer type
				}
			}
		case chat1.MessageType_EDIT:
			mv.Renderable = false
			// Return the edit body for display in the original
			mv.Body = fmt.Sprintf("%v [edited]", body.Edit().Body)
		case chat1.MessageType_DELETE:
			mv.Renderable = false
		case chat1.MessageType_METADATA:
			mv.Renderable = false
		case chat1.MessageType_TLFNAME:
			mv.Renderable = false
		default:
			return mv, fmt.Errorf(fmt.Sprintf("unsupported MessageType: %s", typ.String()))
		}
	default:
		return mv, fmt.Errorf(fmt.Sprintf("MessagePlaintext version error: %s", err))
	}
	return mv, nil
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
