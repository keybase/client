package client

import (
	"fmt"
	"math"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/keybase/client/go/flexibletable"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"golang.org/x/net/context"
	emoji "gopkg.in/kyokomi/emoji.v1"
)

const publicConvNamePrefix = "(public) "

type conversationInfoListView []chat1.ConversationLocal

func (v conversationInfoListView) show(g *libkb.GlobalContext) error {
	if len(v) == 0 {
		return nil
	}

	ui := g.UI.GetTerminalUI()
	w, _ := ui.TerminalSize()

	table := &flexibletable.Table{}
	for i, conv := range v {
		if conv.Error != nil {
			continue
		}
		participants := strings.Split(conv.Info.TlfName, ",")
		vis := "private"
		if conv.Info.Visibility == keybase1.TLFVisibility_PUBLIC {
			vis = "public"
		}
		var reset string
		if conv.Info.FinalizeInfo != nil {
			reset = conv.Info.FinalizeInfo.BeforeSummary()
		}
		table.Insert(flexibletable.Row{
			flexibletable.Cell{
				Frame:     [2]string{"[", "]"},
				Alignment: flexibletable.Right,
				Content:   flexibletable.SingleCell{Item: strconv.Itoa(i + 1)},
			},
			flexibletable.Cell{
				Alignment: flexibletable.Left,
				Content:   flexibletable.SingleCell{Item: vis},
			},
			flexibletable.Cell{
				Alignment: flexibletable.Left,
				Content:   flexibletable.MultiCell{Sep: ",", Items: participants},
			},
			flexibletable.Cell{
				Alignment: flexibletable.Left,
				Content:   flexibletable.SingleCell{Item: reset},
			},
		})
	}
	if err := table.Render(ui.OutputWriter(), " ", w, []flexibletable.ColumnConstraint{
		5, // visualIndex
		8, // vis
		flexibletable.ExpandableWrappable, // participants
		flexibletable.ExpandableWrappable, // reset
	}); err != nil {
		return fmt.Errorf("rendering conversation info list view error: %v\n", err)
	}

	return nil
}

type conversationListView []chat1.ConversationLocal

func (v conversationListView) convNameTeam(g *libkb.GlobalContext, conv chat1.ConversationLocal) string {
	return fmt.Sprintf("%s [#%s]", conv.Info.TlfName, conv.Info.TopicName)
}

func (v conversationListView) convNameKBFS(g *libkb.GlobalContext, conv chat1.ConversationLocal, myUsername string) string {
	var name string
	if conv.Info.Visibility == keybase1.TLFVisibility_PUBLIC {
		name = publicConvNamePrefix + strings.Join(conv.Names(), ",")
	} else {
		name = strings.Join(v.without(g, conv.Names(), myUsername), ",")
		if len(conv.Names()) == 1 && conv.Names()[0] == myUsername {
			// The user is the only writer.
			name = myUsername
		}
	}
	if conv.Info.FinalizeInfo != nil {
		name += " " + conv.Info.FinalizeInfo.BeforeSummary()
	}

	return name
}

// Make a name that looks like a tlfname but is sorted by activity and missing myUsername.
func (v conversationListView) convName(g *libkb.GlobalContext, conv chat1.ConversationLocal, myUsername string) string {
	switch conv.GetMembersType() {
	case chat1.ConversationMembersType_TEAM:
		return v.convNameTeam(g, conv)
	case chat1.ConversationMembersType_KBFS, chat1.ConversationMembersType_IMPTEAMNATIVE,
		chat1.ConversationMembersType_IMPTEAMUPGRADE:
		return v.convNameKBFS(g, conv, myUsername)
	}
	return ""
}

// Make a name that looks like a tlfname but is sorted by activity and missing myUsername.
// This is the less featureful version for convs that can't be unboxed.
func (v conversationListView) convNameLite(g *libkb.GlobalContext, convErr chat1.ConversationErrorRekey, myUsername string) string {
	var name string
	if convErr.TlfPublic {
		name = publicConvNamePrefix + strings.Join(convErr.WriterNames, ",")
	} else {
		name = strings.Join(v.without(g, convErr.WriterNames, myUsername), ",")
		if len(convErr.WriterNames) == 1 && convErr.WriterNames[0] == myUsername {
			// The user is the only writer.
			name = myUsername
		}
	}
	if len(convErr.ReaderNames) > 0 {
		name += "#" + strings.Join(convErr.ReaderNames, ",")
	}

	return name
}

// When we hit identify failures looking up a conversation, we short-circuit
// before we get to parsing out readers and writers (which itself does more
// identifying). Instead we get an untrusted TLF name string, and we have the
// visibility. Cobble together a poor man's conversation name from those, by
// hacking out the current user's name. This should only be displayed next to
// an indication that it's unverified.
func formatUnverifiedConvName(unverifiedTLFName string, visibility keybase1.TLFVisibility, myUsername string) string {
	// Strip the user's name out if it's got a comma next to it. (Two cases to
	// handle: leading and trailing.) This both takes care of dangling commas,
	// and preserves the user's name if it's by itself.
	strippedTLFName := strings.Replace(unverifiedTLFName, ","+myUsername, "", -1)
	strippedTLFName = strings.Replace(strippedTLFName, myUsername+",", "", -1)
	if visibility == keybase1.TLFVisibility_PUBLIC {
		return publicConvNamePrefix + strippedTLFName
	}
	return strippedTLFName
}

func (v conversationListView) without(g *libkb.GlobalContext, slice []string, el string) (res []string) {
	for _, x := range slice {
		if x != el {
			res = append(res, x)
		}
	}
	return res
}

func (v conversationListView) show(g *libkb.GlobalContext, myUsername string, showDeviceName bool) (err error) {
	if len(v) == 0 {
		return nil
	}

	ui := g.UI.GetTerminalUI()
	w, _ := ui.TerminalSize()

	table := &flexibletable.Table{}
	for i, conv := range v {

		if conv.Error != nil {
			unverifiedConvName := formatUnverifiedConvName(conv.Error.UnverifiedTLFName, conv.Info.Visibility, myUsername)
			row := flexibletable.Row{
				flexibletable.Cell{
					Frame:     [2]string{"[", "]"},
					Alignment: flexibletable.Right,
					Content:   flexibletable.SingleCell{Item: strconv.Itoa(i + 1)},
				},
				flexibletable.Cell{ // unread
					Alignment: flexibletable.Center,
					Content:   flexibletable.SingleCell{Item: ""},
				},
				flexibletable.Cell{
					Alignment: flexibletable.Left,
					Content:   flexibletable.SingleCell{Item: "(unverified) " + unverifiedConvName},
				},
				flexibletable.Cell{ // authorAndTime
					Frame:     [2]string{"[", "]"},
					Alignment: flexibletable.Right,
					Content:   flexibletable.SingleCell{Item: "???"},
				},
				flexibletable.Cell{ // ephemeralInfo
					Alignment: flexibletable.Center,
					Content:   flexibletable.SingleCell{Item: "???"},
				},
				flexibletable.Cell{ // reactionInfo
					Alignment: flexibletable.Center,
					Content:   flexibletable.SingleCell{Item: "???"},
				},
				flexibletable.Cell{
					Alignment: flexibletable.Left,
					Content:   flexibletable.SingleCell{Item: conv.Error.Message},
				},
			}

			if conv.Error.RekeyInfo != nil {
				row[2].Content = flexibletable.SingleCell{Item: v.convNameLite(g, *conv.Error.RekeyInfo, myUsername)}
				row[3].Content = flexibletable.SingleCell{Item: ""}
				switch conv.Error.Typ {
				case chat1.ConversationErrorType_SELFREKEYNEEDED:
					row[4].Content = flexibletable.SingleCell{Item: "Rekey needed. Waiting for a participant to open their Keybase app."}
				case chat1.ConversationErrorType_OTHERREKEYNEEDED:
					row[4].Content = flexibletable.SingleCell{Item: "Rekey needed. Waiting for another participant to open their Keybase app."}
				}
			}

			table.Insert(row)
			continue
		}

		if conv.IsEmpty {
			// Don't display empty conversations
			continue
		}

		unread := ""
		// Show the last visible message.
		var msg *chat1.MessageUnboxed
		for _, m := range conv.MaxMessages {
			mv2, err := newMessageView(g, conv.Info.Id, m)
			if err != nil {
				g.Log.CDebugf(context.TODO(), "Message render error: %s", err)
				continue
			}
			if !mv2.Renderable {
				continue
			}
			if conv.ReaderInfo.ReadMsgid < m.GetMessageID() {
				unread = "*"
			}
			if msg == nil || m.GetMessageID() > msg.GetMessageID() {
				mCopy := m
				msg = &mCopy
			}
		}
		mv := newMessageViewNoMessages()
		if msg != nil {
			mv, err = newMessageView(g, conv.Info.Id, *msg)
			if err != nil {
				g.Log.Error("Message render error: %s", err)
			}

		} else {
			unread = ""
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
				Content:   flexibletable.SingleCell{Item: v.convName(g, conv, myUsername)},
			},
			flexibletable.Cell{
				Frame:     [2]string{"[", "]"},
				Alignment: flexibletable.Right,
				Content:   flexibletable.SingleCell{Item: authorAndTime},
			},
			flexibletable.Cell{
				Alignment: flexibletable.Center,
				Content:   flexibletable.SingleCell{Item: mv.EphemeralInfo},
			},
			flexibletable.Cell{
				Alignment: flexibletable.Center,
				Content:   flexibletable.SingleCell{Item: mv.ReactionInfo},
			},
			flexibletable.Cell{
				Alignment: flexibletable.Left,
				Content:   flexibletable.SingleCell{Item: body},
			},
		})
	}

	if table.NumInserts() == 0 {
		ui.Printf("no conversations\n")
		return nil
	}

	if err := table.Render(ui.OutputWriter(), " ", w, []flexibletable.ColumnConstraint{
		5, // visualIndex
		1, // unread
		flexibletable.ColumnConstraint(w / 5), // convName
		flexibletable.ColumnConstraint(w / 5), // authorAndTime
		flexibletable.ColumnConstraint(w / 5), // ephemeralInfo
		flexibletable.ColumnConstraint(w / 5), // reactionInfo
		flexibletable.Expandable,              // body
	}); err != nil {
		return fmt.Errorf("rendering conversation list view error: %v\n", err)
	}

	return nil
}

type conversationView struct {
	conversation chat1.ConversationLocal
	messages     []chat1.MessageUnboxed
}

func (v conversationView) show(g *libkb.GlobalContext, showDeviceName bool) error {
	if len(v.messages) == 0 {
		return nil
	}

	ui := g.UI.GetTerminalUI()
	w, _ := ui.TerminalSize()
	showRevokeAdvisory := false

	headline, err := v.headline(g)
	if err != nil {
		return err
	}
	if headline != "" {
		g.UI.GetTerminalUI().Printf("headline: %s\n\n", headline)
	}

	table := &flexibletable.Table{}
	visualIndex := 0
	for i := len(v.messages) - 1; i >= 0; i-- {
		m := v.messages[i]
		mv, err := newMessageView(g, v.conversation.Info.Id, m)
		if err != nil {
			g.Log.Error("Message render error: %s", err)
		}

		if !mv.Renderable {
			continue
		}

		if mv.FromRevokedDevice {
			showRevokeAdvisory = true
		}

		unread := ""
		if m.IsValid() &&
			v.conversation.ReaderInfo.ReadMsgid < m.GetMessageID() {
			unread = "*"
		}

		var authorAndTime string
		if showDeviceName {
			authorAndTime = mv.AuthorAndTimeWithDeviceName
		} else {
			authorAndTime = mv.AuthorAndTime
		}

		visualIndex++
		table.Insert(flexibletable.Row{
			flexibletable.Cell{
				Frame:     [2]string{"[", "]"},
				Alignment: flexibletable.Right,
				Content:   flexibletable.SingleCell{Item: strconv.Itoa(visualIndex)},
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
				Alignment: flexibletable.Center,
				Content:   flexibletable.SingleCell{Item: mv.EphemeralInfo},
			},
			flexibletable.Cell{
				Alignment: flexibletable.Center,
				Content:   flexibletable.SingleCell{Item: mv.ReactionInfo},
			},
			flexibletable.Cell{
				Alignment: flexibletable.Left,
				Content:   flexibletable.SingleCell{Item: mv.Body},
			},
		})
	}
	if err := table.Render(ui.OutputWriter(), " ", w, []flexibletable.ColumnConstraint{
		5, // visualIndex
		1, // unread
		flexibletable.ColumnConstraint(w / 5), // authorAndTime
		flexibletable.ColumnConstraint(w / 5), // ephemeralInfo
		flexibletable.ColumnConstraint(w / 5), // reactionInfo
		flexibletable.ExpandableWrappable,     // body
	}); err != nil {
		return fmt.Errorf("rendering conversation view error: %v\n", err)
	}

	if showRevokeAdvisory {
		g.UI.GetTerminalUI().Printf("\nNote: Messages with (!) next to the sender were sent from a device that is now revoked.\n")
	}

	return nil
}

// Read the headline off the HEADLINE message in MaxMessages.
// Returns "" when there is no headline set.
func (v conversationView) headline(g *libkb.GlobalContext) (string, error) {
	for _, m := range v.conversation.MaxMessages {
		if !m.IsValid() {
			continue
		}
		body := m.Valid().MessageBody
		typ, err := body.MessageType()
		if err != nil {
			continue
		}
		switch typ {
		case chat1.MessageType_HEADLINE:
			return body.Headline().Headline, nil
		default:
			continue
		}
	}

	return "", nil
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
	EphemeralInfo               string
	ReactionInfo                string
	FromRevokedDevice           bool

	// Used internally for supersedeers
	messageType chat1.MessageType
}

func formatSystemMessage(body chat1.MessageSystem) string {
	typ, err := body.SystemType()
	if err != nil {
		return "<unknown system message>"
	}
	switch typ {
	case chat1.MessageSystemType_ADDEDTOTEAM:
		return fmt.Sprintf("[Added @%s to the team]", body.Addedtoteam().Addee)
	case chat1.MessageSystemType_INVITEADDEDTOTEAM:
		return fmt.Sprintf("[Added %s to the team (invited by @%s)]",
			body.Inviteaddedtoteam().Invitee, body.Inviteaddedtoteam().Inviter)
	case chat1.MessageSystemType_COMPLEXTEAM:
		return fmt.Sprintf("[Created a new channel in %s]", body.Complexteam().Team)
	case chat1.MessageSystemType_CREATETEAM:
		return fmt.Sprintf("[%s created the team %s]", body.Createteam().Creator, body.Createteam().Team)
	case chat1.MessageSystemType_GITPUSH:
		switch body.Gitpush().PushType {
		case keybase1.GitPushType_CREATEREPO:
			return fmt.Sprintf("[git %s created the repo %s]", body.Gitpush().Pusher, body.Gitpush().RepoName)
		case keybase1.GitPushType_RENAMEREPO:
			return fmt.Sprintf("[git %s changed the name of the repo %s to %s]", body.Gitpush().Pusher, body.Gitpush().PreviousRepoName, body.Gitpush().RepoName)
		default:
			total := keybase1.TotalNumberOfCommits(body.Gitpush().Refs)
			names := keybase1.RefNames(body.Gitpush().Refs)
			return fmt.Sprintf("[git (%s) %s pushed %d commits to %s]", body.Gitpush().RepoName,
				body.Gitpush().Pusher, total, names)
		}
	case chat1.MessageSystemType_CHANGEAVATAR:
		return fmt.Sprintf("[%s changed team avatar]", body.Changeavatar().User)
	}
	return "<unknown system message>"
}

func formatSendPaymentMessage(g *libkb.GlobalContext, body chat1.MessageSendPayment) string {
	ctx := context.Background()

	cli, err := GetWalletClient(g)
	if err != nil {
		g.Log.CDebugf(ctx, "GetWalletClient() error: %s", err)
		return "[error getting payment details]"
	}
	details, err := cli.PaymentDetailCLILocal(ctx, body.KbTxID)
	if err != nil {
		g.Log.CDebugf(ctx, "PaymentDetailCLILocal() error: %s", err)
		return "[error getting payment details]"
	}

	ls := strings.ToLower(details.Status)
	if ls != "completed" && ls != "pending" {
		return fmt.Sprintf("error sending payment: %s", details.StatusDetail)
	}

	verb := "sent"
	if ls == "pending" {
		verb = "sending"
	}

	amountXLM := fmt.Sprintf("%s XLM", libkb.StellarSimplifyAmount(details.Amount))

	var amountDescription string
	if details.DisplayAmount != nil && details.DisplayCurrency != nil && len(*details.DisplayAmount) > 0 && len(*details.DisplayAmount) > 0 {
		amountDescription = fmt.Sprintf("Lumens worth %s %s (%s)", *details.DisplayAmount, *details.DisplayCurrency, amountXLM)
	} else {
		amountDescription = amountXLM
	}

	view := verb + " " + amountDescription
	if details.Note != "" {
		view += "\n> " + details.Note
	}

	return view
}

func formatRequestPaymentMessage(g *libkb.GlobalContext, body chat1.MessageRequestPayment) (view string) {
	const formattingErrorStr = "[error getting request details]"
	ctx := context.Background()

	cli, err := GetWalletClient(g)
	if err != nil {
		g.Log.CDebugf(ctx, "GetWalletClient() error: %s", err)
		return formattingErrorStr
	}

	details, err := cli.GetRequestDetailsLocal(ctx, stellar1.KeybaseRequestID(body.RequestID))
	if err != nil {
		g.Log.CDebugf(ctx, "GetRequestDetailsLocal failed with: %s", err)
		return formattingErrorStr
	}

	if details.Currency != nil {
		view = fmt.Sprintf("requested Lumens worth %s (%s)", details.AmountDescription,
			details.AmountStellarDescription)
	} else {
		view = fmt.Sprintf("requested %s", details.AmountDescription)
	}

	if details.Status == stellar1.RequestStatus_CANCELED {
		view = "[canceled] " + view
	}

	if len(body.Note) > 0 {
		view += "\n> " + body.Note
	}
	return view
}

func newMessageViewValid(g *libkb.GlobalContext, conversationID chat1.ConversationID, m chat1.MessageUnboxedValid) (mv messageView, err error) {
	mv.MessageID = m.ServerHeader.MessageID
	mv.FromRevokedDevice = m.SenderDeviceRevokedAt != nil

	body := m.MessageBody
	typ, err := body.MessageType()
	mv.messageType = typ
	if err != nil {
		return mv, err
	}
	switch typ {
	case chat1.MessageType_NONE:
		// NONE is what you get when a message has been deleted.
		mv.Renderable = true
		mv.Body = "[deleted]"
	case chat1.MessageType_TEXT:
		mv.Renderable = true
		mv.Body = body.Text().Body
		if m.ServerHeader.SupersededBy > 0 {
			mv.Body += " (edited)"
		}
	case chat1.MessageType_ATTACHMENT:
		mv.Renderable = true
		att := body.Attachment()
		title := att.Object.Title
		if title == "" {
			title = filepath.Base(att.Object.Filename)
		}
		mv.Body = fmt.Sprintf("%s <attachment ID: %d>", title, m.ServerHeader.MessageID)
		if len(att.Previews) > 0 {
			mv.Body += " [preview available]"
		}
		if att.Uploaded {
			mv.Body += " (uploaded)"
		} else {
			mv.Body += " (...)"
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
	case chat1.MessageType_HEADLINE:
		mv.Renderable = false
	case chat1.MessageType_ATTACHMENTUPLOADED:
		mv.Renderable = false
	case chat1.MessageType_JOIN:
		mv.Renderable = true
		mv.Body = "[Joined the channel]"
	case chat1.MessageType_LEAVE:
		mv.Renderable = true
		mv.Body = "[Left the channel]"
	case chat1.MessageType_SYSTEM:
		mv.Renderable = true
		mv.Body = formatSystemMessage(m.MessageBody.System())
	case chat1.MessageType_SENDPAYMENT:
		mv.Renderable = true
		mv.Body = formatSendPaymentMessage(g, m.MessageBody.Sendpayment())
	case chat1.MessageType_REQUESTPAYMENT:
		mv.Renderable = true
		mv.Body = formatRequestPaymentMessage(g, m.MessageBody.Requestpayment())
	default:
		return mv, fmt.Errorf(fmt.Sprintf("unsupported MessageType: %s", typ.String()))
	}

	possiblyRevokedMark := ""
	if mv.FromRevokedDevice {
		possiblyRevokedMark = "(!)"
	}
	t := gregor1.FromTime(m.ServerHeader.Ctime)
	mv.AuthorAndTime = fmt.Sprintf("%s%s %s",
		m.SenderUsername, possiblyRevokedMark, shortDurationFromNow(t))
	mv.AuthorAndTimeWithDeviceName = fmt.Sprintf("%s%s <%s> %s",
		m.SenderUsername, possiblyRevokedMark, m.SenderDeviceName, shortDurationFromNow(t))

	if m.IsEphemeral() {
		if m.IsEphemeralExpired(time.Now()) {
			var explodedByText string
			if m.ExplodedBy() != nil {
				explodedByText = fmt.Sprintf(" by %s", *m.ExplodedBy())
			}
			mv.Body = fmt.Sprintf("[exploded%s] ", explodedByText)
			for i := 0; i < 40; i++ {
				mv.Body += "* "
			}
		} else {
			remainingEphemeralLifetime := m.RemainingEphemeralLifetime(time.Now())
			mv.EphemeralInfo = fmt.Sprintf("[expires in %s]", remainingEphemeralLifetime)
		}
	}

	// sort reactions so the ordering is stable when rendering
	reactionTexts := []string{}
	for reactionText := range m.Reactions.Reactions {
		reactionTexts = append(reactionTexts, reactionText)
	}
	sort.Strings(reactionTexts)

	var reactionInfo string
	for _, reactionText := range reactionTexts {
		reactions := m.Reactions.Reactions[reactionText]
		reactionInfo += emoji.Sprintf("%v[%d] ", reactionText, len(reactions))
	}
	mv.ReactionInfo = reactionInfo

	return mv, nil
}

func outboxStateView(state chat1.OutboxState, body string) string {
	var ststr string
	st, err := state.State()
	if err != nil {
		return "<unknown state>"
	}
	switch st {
	case chat1.OutboxStateType_SENDING:
		ststr = "<sending>"
	case chat1.OutboxStateType_ERROR:
		ststr = "<error>"
	}

	return fmt.Sprintf("[outbox message: state: %s contents: %s]", ststr, body)
}

func newMessageViewOutbox(g *libkb.GlobalContext, conversationID chat1.ConversationID, m chat1.OutboxRecord) (mv messageView, err error) {

	body := m.Msg.MessageBody
	typ, err := body.MessageType()
	mv.messageType = typ
	if err != nil {
		return mv, err
	}
	switch typ {
	case chat1.MessageType_TEXT:
		mv.Body = m.Msg.MessageBody.Text().Body
		mv.Renderable = true
	case chat1.MessageType_ATTACHMENT:
		// TODO: fix me?
		mv.Body = "<attachment>"
		mv.Renderable = true
	case chat1.MessageType_EDIT:
		mv.Body = fmt.Sprintf("<edit message: %s>", m.Msg.MessageBody.Edit().Body)
		mv.Renderable = true
	case chat1.MessageType_DELETE:
		mv.Body = "<delete message>"
		mv.Renderable = true
	default:
		mv.Body = "<unknown message type>"
		mv.Renderable = true
	}
	mv.Body = outboxStateView(m.State, mv.Body)

	t := gregor1.FromTime(m.Ctime)
	username := g.Env.GetUsername().String()
	mv.FromRevokedDevice = false
	mv.MessageID = m.Msg.ClientHeader.OutboxInfo.Prev
	mv.AuthorAndTime = fmt.Sprintf("%s %s", username, shortDurationFromNow(t))
	mv.AuthorAndTimeWithDeviceName = fmt.Sprintf("%s <current> %s", username, shortDurationFromNow(t))

	return mv, nil
}

func newMessageViewError(g *libkb.GlobalContext, conversationID chat1.ConversationID,
	m chat1.MessageUnboxedError) (mv messageView, err error) {

	mv.messageType = m.MessageType
	mv.Renderable = true
	mv.FromRevokedDevice = false
	mv.MessageID = m.MessageID
	mv.AuthorAndTime = "???"
	mv.AuthorAndTimeWithDeviceName = "???"

	critVersion := false
	switch m.ErrType {
	case chat1.MessageUnboxedErrorType_BADVERSION_CRITICAL:
		critVersion = true
		fallthrough
	case chat1.MessageUnboxedErrorType_BADVERSION:
		mv.Body = fmt.Sprintf("<chat read error: invalid message version (critical: %v)>", critVersion)
	default:
		mv.Body = fmt.Sprintf("<chat read error: %s>", m.ErrMsg)
	}

	return mv, nil
}

func newMessageViewNoMessages() (mv messageView) {
	return messageView{
		Renderable: true,
		Body:       "<no messages>",
	}
}

// newMessageView extracts from a message the parts for display
// It may fetch the superseding message. So that for example a TEXT message will show its EDIT text.
func newMessageView(g *libkb.GlobalContext, conversationID chat1.ConversationID, m chat1.MessageUnboxed) (mv messageView, err error) {
	state, err := m.State()
	if err != nil {
		return mv, fmt.Errorf("unexpected empty message")
	}
	switch state {
	case chat1.MessageUnboxedState_ERROR:
		return newMessageViewError(g, conversationID, m.Error())
	case chat1.MessageUnboxedState_OUTBOX:
		return newMessageViewOutbox(g, conversationID, m.Outbox())
	case chat1.MessageUnboxedState_VALID:
		return newMessageViewValid(g, conversationID, m.Valid())
	default:
		return mv, fmt.Errorf("unexpected message state: %v", state)
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
