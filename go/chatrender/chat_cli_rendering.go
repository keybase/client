package chatrender

import (
	"context"
	"fmt"
	"io"
	"math"
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
	"github.com/kyokomi/emoji"
)

const publicConvNamePrefix = "(public) "

type ConversationInfoListView []chat1.ConversationLocal

func (v ConversationInfoListView) Show(g *libkb.GlobalContext) error {
	ui := g.UI.GetTerminalUI()
	w, _ := ui.TerminalSize()
	return v.RenderToWriter(g, ui.OutputWriter(), w)
}

func (v ConversationInfoListView) RenderToWriter(g *libkb.GlobalContext, writer io.Writer, width int) error {
	if len(v) == 0 {
		return nil
	}

	table := &flexibletable.Table{}
	for i, conv := range v {
		var tlfName string
		if conv.Error != nil {
			tlfName = fmt.Sprintf("(unverified) %v",
				formatUnverifiedConvName(conv.Error.UnverifiedTLFName, conv.Info.Visibility, g.Env.GetUsername().String()))
		} else {
			tlfName = conv.Info.TlfName
		}
		vis := "private"
		if conv.Info.Visibility == keybase1.TLFVisibility_PUBLIC {
			vis = "public"
		}
		var reset string
		if conv.Info.FinalizeInfo != nil {
			reset = conv.Info.FinalizeInfo.BeforeSummary()
		}
		err := table.Insert(flexibletable.Row{
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
				Content:   flexibletable.SingleCell{Item: tlfName},
			},
			flexibletable.Cell{
				Alignment: flexibletable.Left,
				Content:   flexibletable.SingleCell{Item: reset},
			},
		})
		if err != nil {
			return err
		}
	}
	if err := table.Render(writer, " ", width, []flexibletable.ColumnConstraint{
		15,                                // visualIndex
		8,                                 // vis
		flexibletable.ExpandableWrappable, // participants
		flexibletable.ExpandableWrappable, // reset
	}); err != nil {
		return fmt.Errorf("rendering conversation info list view error: %v\n", err)
	}

	return nil
}

type ConversationListView []chat1.ConversationLocal

func convNameTeam(g *libkb.GlobalContext, conv chat1.ConversationLocal) string {
	return fmt.Sprintf("%s [#%s]", conv.Info.TlfName, conv.Info.TopicName)
}

func convNameKBFS(g *libkb.GlobalContext, conv chat1.ConversationLocal, myUsername string) string {
	var name string
	if conv.Info.Visibility == keybase1.TLFVisibility_PUBLIC {
		name = publicConvNamePrefix + strings.Join(conv.ConvNameNames(), ",")
	} else {
		name = strings.Join(without(g, conv.ConvNameNames(), myUsername), ",")
		if len(conv.ConvNameNames()) == 1 && conv.ConvNameNames()[0] == myUsername {
			// The user is the only writer.
			name = myUsername
		}
	}
	if conv.Info.FinalizeInfo != nil {
		name += " " + conv.Info.FinalizeInfo.BeforeSummary()
	}

	return name
}

// Make a name that looks like a tlfname but is sorted by activity and missing
// myUsername.
func ConvName(g *libkb.GlobalContext, conv chat1.ConversationLocal, myUsername string) string {
	switch conv.GetMembersType() {
	case chat1.ConversationMembersType_TEAM:
		return convNameTeam(g, conv)
	case chat1.ConversationMembersType_KBFS, chat1.ConversationMembersType_IMPTEAMNATIVE,
		chat1.ConversationMembersType_IMPTEAMUPGRADE:
		return convNameKBFS(g, conv, myUsername)
	}
	return ""
}

// Make a name that looks like a tlfname but is sorted by activity and missing myUsername.
// This is the less featureful version for convs that can't be unboxed.
func (v ConversationListView) convNameLite(g *libkb.GlobalContext, convErr chat1.ConversationErrorRekey, myUsername string) string {
	var name string
	if convErr.TlfPublic {
		name = publicConvNamePrefix + strings.Join(convErr.WriterNames, ",")
	} else {
		name = strings.Join(without(g, convErr.WriterNames, myUsername), ",")
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
	strippedTLFName := strings.ReplaceAll(unverifiedTLFName, ","+myUsername, "")
	strippedTLFName = strings.ReplaceAll(strippedTLFName, myUsername+",", "")
	if visibility == keybase1.TLFVisibility_PUBLIC {
		return publicConvNamePrefix + strippedTLFName
	}
	return strippedTLFName
}

func without(g *libkb.GlobalContext, slice []string, el string) (res []string) {
	for _, x := range slice {
		if x != el {
			res = append(res, x)
		}
	}
	return res
}

func (v ConversationListView) Show(g *libkb.GlobalContext, myUsername string, showDeviceName bool) (err error) {
	ui := g.UI.GetTerminalUI()
	w, _ := ui.TerminalSize()
	return v.RenderToWriter(g, ui.OutputWriter(), w, myUsername, showDeviceName, RenderOptions{})
}

func (v ConversationListView) RenderToWriter(g *libkb.GlobalContext, writer io.Writer, width int, myUsername string, showDeviceName bool, opts RenderOptions) (err error) {
	if len(v) == 0 {
		fmt.Fprint(writer, "no conversations\n")
		return nil
	}

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
				flexibletable.Cell{ // restrictedBotInfo
					Alignment: flexibletable.Center,
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

			err := table.Insert(row)
			if err != nil {
				return err
			}
			continue
		}

		if conv.IsEmpty {
			// Don't display empty conversations
			continue
		}

		unread := ""
		// Show the last visible message.
		msg := conv.Info.SnippetMsg
		if msg != nil && conv.ReaderInfo.ReadMsgid < msg.GetMessageID() {
			unread = "*"
		}
		mv := newMessageViewNoMessages()
		if msg != nil {
			mv, err = newMessageView(g, opts, conv.Info.Id, *msg)
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

		err := table.Insert(flexibletable.Row{
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
				Content:   flexibletable.SingleCell{Item: ConvName(g, conv, myUsername)},
			},
			flexibletable.Cell{
				Frame:     [2]string{"[", "]"},
				Alignment: flexibletable.Right,
				Content:   flexibletable.SingleCell{Item: authorAndTime},
			},
			flexibletable.Cell{
				Alignment: flexibletable.Center,
				Content:   flexibletable.SingleCell{Item: mv.RestrictedBotInfo},
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
		if err != nil {
			return err
		}
	}

	if table.NumInserts() == 0 {
		fmt.Fprint(writer, "no conversations\n")
		return nil
	}

	if err := table.Render(writer, " ", width, []flexibletable.ColumnConstraint{
		15, // visualIndex
		1,  // unread
		flexibletable.ColumnConstraint(width / 5), // convName
		flexibletable.ColumnConstraint(width / 5), // authorAndTime
		flexibletable.ColumnConstraint(width / 5), // RestrictedBotInfo
		flexibletable.ColumnConstraint(width / 5), // ephemeralInfo
		flexibletable.ColumnConstraint(width / 5), // reactionInfo
		flexibletable.Expandable,                  // body
	}); err != nil {
		return fmt.Errorf("rendering conversation list view error: %v\n", err)
	}

	return nil
}

type RenderOptions struct {
	UseDateTime     bool
	SkipHeadline    bool
	GetWalletClient func(g *libkb.GlobalContext) (cli stellar1.LocalClient, err error)
}

type ConversationView struct {
	Conversation chat1.ConversationLocal
	Messages     []chat1.MessageUnboxed
	Opts         RenderOptions
}

func (v ConversationView) Show(g *libkb.GlobalContext, showDeviceName bool) error {
	ui := g.UI.GetTerminalUI()
	w, _ := ui.TerminalSize()
	return v.RenderToWriter(g, ui.OutputWriter(), w, showDeviceName)
}

func (v ConversationView) RenderToWriter(g *libkb.GlobalContext, writer io.Writer, width int, showDeviceName bool) error {
	if len(v.Messages) == 0 {
		return nil
	}

	showRevokeAdvisory := false

	headline := v.Conversation.Info.Headline
	if headline != "" && !v.Opts.SkipHeadline {
		fmt.Fprintf(writer, "headline: %s\n\n", headline)
	}

	table := &flexibletable.Table{}
	for i := len(v.Messages) - 1; i >= 0; i-- {
		m := v.Messages[i]
		mv, err := newMessageView(g, v.Opts, v.Conversation.Info.Id, m)
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
			v.Conversation.ReaderInfo.ReadMsgid < m.GetMessageID() {
			unread = "*"
		}

		var authorAndTime string
		if showDeviceName {
			authorAndTime = mv.AuthorAndTimeWithDeviceName
		} else {
			authorAndTime = mv.AuthorAndTime
		}

		err = table.Insert(flexibletable.Row{
			flexibletable.Cell{
				Frame:     [2]string{"[", "]"},
				Alignment: flexibletable.Right,
				Content:   flexibletable.SingleCell{Item: strconv.Itoa(int(mv.MessageID))},
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
				Content:   flexibletable.SingleCell{Item: mv.RestrictedBotInfo},
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
		if err != nil {
			return err
		}
	}
	if err := table.Render(writer, " ", width, []flexibletable.ColumnConstraint{
		15, // messageID
		1,  // unread
		flexibletable.ColumnConstraint(width / 5), // authorAndTime
		flexibletable.ColumnConstraint(width / 5), // restrictedBotInfo
		flexibletable.ColumnConstraint(width / 5), // ephemeralInfo
		flexibletable.ColumnConstraint(width / 5), // reactionInfo
		flexibletable.ExpandableWrappable,         // body
	}); err != nil {
		return fmt.Errorf("rendering conversation view error: %v\n", err)
	}

	if showRevokeAdvisory {
		fmt.Fprint(writer, "\nNote: Messages with (!) next to the sender were sent from a device that is now revoked.\n")
	}

	return nil
}

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
	RestrictedBotInfo           string
	ReactionInfo                string
	FromRevokedDevice           bool

	// Used internally for supersedeers
	messageType chat1.MessageType
}

func formatSystemMessage(body chat1.MessageSystem) string {
	m := body.String()
	if m == "" {
		return "<unknown system message>"
	}
	return fmt.Sprintf("[%s]", m)
}

func formatSendPaymentMessage(g *libkb.GlobalContext, opts RenderOptions, body chat1.MessageSendPayment) string {
	ctx := context.Background()
	if opts.GetWalletClient == nil {
		return fmt.Sprintf("<paymentID %s>", body.PaymentID)
	}

	cli, err := opts.GetWalletClient(g)
	if err != nil {
		g.Log.CDebugf(ctx, "GetWalletClient() error: %s", err)
		return "[error getting payment details]"
	}
	details, err := cli.PaymentDetailCLILocal(ctx, stellar1.TransactionIDFromPaymentID(body.PaymentID).String())
	if err != nil {
		g.Log.CDebugf(ctx, "PaymentDetailCLILocal() error: %s", err)
		return "[error getting payment details]"
	}

	var verb string
	statusStr := strings.ToLower(details.Status)
	switch statusStr {
	case "completed", "claimable":
		verb = "sent"
	case "canceled":
		verb = "canceled sending"
	case "pending":
		verb = "sending"
	default:
		return fmt.Sprintf("error sending payment: %s %s", details.Status, details.StatusDetail)
	}

	amountXLM := fmt.Sprintf("%s XLM", libkb.StellarSimplifyAmount(details.Amount))

	var amountDescription string
	if details.DisplayAmount != nil && details.DisplayCurrency != nil && len(*details.DisplayAmount) > 0 && len(*details.DisplayAmount) > 0 {
		amountDescription = fmt.Sprintf("Lumens worth %s %s (%s)", *details.DisplayAmount, *details.DisplayCurrency, amountXLM)
	} else {
		amountDescription = amountXLM
	}

	view := verb + " " + amountDescription
	if statusStr == "claimable" {
		// e.g. "Waiting for the recipient to open the app to claim, or the sender to cancel."
		view += fmt.Sprintf("\n%s", details.StatusDetail)
	}
	if details.Note != "" {
		view += "\n> " + details.Note
	}

	return view
}

func formatRequestPaymentMessage(g *libkb.GlobalContext, opts RenderOptions, body chat1.MessageRequestPayment) (view string) {
	if opts.GetWalletClient == nil {
		return fmt.Sprintf("<reqeustID %s>", body.RequestID)
	}

	const formattingErrorStr = "[error getting request details]"
	ctx := context.Background()

	cli, err := opts.GetWalletClient(g)
	if err != nil {
		g.Log.CDebugf(ctx, "GetWalletClient() error: %s", err)
		return formattingErrorStr
	}

	details, err := cli.GetRequestDetailsLocal(ctx, stellar1.GetRequestDetailsLocalArg{
		ReqID: body.RequestID,
	})
	if err != nil {
		g.Log.CDebugf(ctx, "GetRequestDetailsLocal failed with: %s", err)
		return formattingErrorStr
	}

	if details.Currency != nil {
		view = fmt.Sprintf("requested Lumens worth %s", details.AmountDescription)
	} else {
		view = fmt.Sprintf("requested %s", details.AmountDescription)
	}

	if len(body.Note) > 0 {
		view += "\n> " + body.Note
	}

	if details.Status == stellar1.RequestStatus_CANCELED {
		// If canceled, add "[canceled]" prefix.
		view = "[canceled] " + view
	} else {
		// If not, append request ID for cancel-request command.
		view += fmt.Sprintf("\n[Request ID: %s]", body.RequestID)
	}

	return view
}

func newMessageViewValid(g *libkb.GlobalContext, opts RenderOptions, conversationID chat1.ConversationID, m chat1.MessageUnboxedValid) (mv messageView, err error) {
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
		mv.Body = fmt.Sprintf("%s <attachment ID: %d>", att.GetTitle(), m.ServerHeader.MessageID)
		if len(att.Previews) > 0 {
			mv.Body += " [preview available]"
		}
		if att.Uploaded {
			mv.Body += " (uploaded)"
		} else {
			mv.Body += " (...)"
		}
		if m.ServerHeader.SupersededBy > 0 {
			mv.Body += " (edited)"
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
		mv.Renderable = true
		mv.Body = fmt.Sprintf("[%s]", m.MessageBody.Headline())
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
	case chat1.MessageType_DELETEHISTORY:
		mv.Renderable = false
	case chat1.MessageType_REACTION:
		mv.Renderable = false
	case chat1.MessageType_SENDPAYMENT:
		mv.Renderable = true
		mv.Body = formatSendPaymentMessage(g, opts, m.MessageBody.Sendpayment())
	case chat1.MessageType_REQUESTPAYMENT:
		mv.Renderable = true
		mv.Body = formatRequestPaymentMessage(g, opts, m.MessageBody.Requestpayment())
	case chat1.MessageType_UNFURL:
		mv.Renderable = false
	case chat1.MessageType_FLIP:
		mv.Renderable = true
		mv.Body = m.MessageBody.Flip().Text
	case chat1.MessageType_PIN:
		mv.Renderable = false
	default:
		return mv, fmt.Errorf("unsupported MessageType: %s", typ.String())
	}

	possiblyRevokedMark := ""
	if mv.FromRevokedDevice {
		possiblyRevokedMark = "(!)"
	}
	t := gregor1.FromTime(m.ServerHeader.Ctime)
	mv.AuthorAndTime = fmt.Sprintf("%s%s %s",
		m.SenderUsername, possiblyRevokedMark, FmtTime(t, opts))
	mv.AuthorAndTimeWithDeviceName = fmt.Sprintf("%s%s <%s> %s",
		m.SenderUsername, possiblyRevokedMark, m.SenderDeviceName, FmtTime(t, opts))

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
	if m.BotUsername != "" {
		mv.RestrictedBotInfo = fmt.Sprintf("[encrypted for bot @%s]", m.BotUsername)
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

func newMessageViewOutbox(g *libkb.GlobalContext, opts RenderOptions, conversationID chat1.ConversationID, m chat1.OutboxRecord) (mv messageView, err error) {

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
	mv.AuthorAndTime = fmt.Sprintf("%s %s", username, FmtTime(t, opts))
	mv.AuthorAndTimeWithDeviceName = fmt.Sprintf("%s <current> %s", username, FmtTime(t, opts))

	return mv, nil
}

func newMessageViewError(g *libkb.GlobalContext, opts RenderOptions, conversationID chat1.ConversationID,
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
func newMessageView(g *libkb.GlobalContext, opts RenderOptions, conversationID chat1.ConversationID, m chat1.MessageUnboxed) (mv messageView, err error) {
	defer func() { mv.Body = emoji.Sprint(mv.Body) }()
	state, err := m.State()
	if err != nil {
		return mv, fmt.Errorf("unexpected empty message")
	}
	switch state {
	case chat1.MessageUnboxedState_ERROR:
		return newMessageViewError(g, opts, conversationID, m.Error())
	case chat1.MessageUnboxedState_OUTBOX:
		return newMessageViewOutbox(g, opts, conversationID, m.Outbox())
	case chat1.MessageUnboxedState_VALID:
		return newMessageViewValid(g, opts, conversationID, m.Valid())
	default:
		return mv, fmt.Errorf("unexpected message state: %v", state)
	}

}

func FmtTime(t time.Time, opts RenderOptions) string {
	if opts.UseDateTime {
		// In go>=1.20 this is time.DateTime
		return t.Format("2006-01-02 15:04:05")
	}
	return ShortDurationFromNow(t)
}

func ShortDurationFromNow(t time.Time) string {
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
