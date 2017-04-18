package utils

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

// parseDurationExtended is like time.ParseDuration, but adds "d" unit. "1d" is
// one day, defined as 24*time.Hour. Only whole days are supported for "d"
// unit, but it can be followed by smaller units, e.g., "1d1h".
func ParseDurationExtended(s string) (d time.Duration, err error) {
	p := strings.Index(s, "d")
	if p == -1 {
		// no "d" suffix
		return time.ParseDuration(s)
	}

	var days int
	if days, err = strconv.Atoi(s[:p]); err != nil {
		return time.Duration(0), err
	}
	d = time.Duration(days) * 24 * time.Hour

	if p < len(s)-1 {
		var dur time.Duration
		if dur, err = time.ParseDuration(s[p+1:]); err != nil {
			return time.Duration(0), err
		}
		d += dur
	}

	return d, nil
}

func ParseTimeFromRFC3339OrDurationFromPast(g *libkb.GlobalContext, s string) (t time.Time, err error) {
	var errt, errd error
	var d time.Duration

	if s == "" {
		return
	}

	if t, errt = time.Parse(time.RFC3339, s); errt == nil {
		return t, nil
	}
	if d, errd = ParseDurationExtended(s); errd == nil {
		return g.Clock().Now().Add(-d), nil
	}

	return time.Time{}, fmt.Errorf("given string is neither a valid time (%s) nor a valid duration (%v)", errt, errd)
}

// upper bounds takes higher priority
func Collar(lower int, ideal int, upper int) int {
	if ideal > upper {
		return upper
	}
	if ideal < lower {
		return lower
	}
	return ideal
}

// AggRateLimitsP takes a list of rate limit responses and dedups them to the last one received
// of each category
func AggRateLimitsP(rlimits []*chat1.RateLimit) (res []chat1.RateLimit) {
	m := make(map[string]chat1.RateLimit)
	for _, l := range rlimits {
		if l != nil {
			m[l.Name] = *l
		}
	}
	for _, v := range m {
		res = append(res, v)
	}
	return res
}

func AggRateLimits(rlimits []chat1.RateLimit) (res []chat1.RateLimit) {
	m := make(map[string]chat1.RateLimit)
	for _, l := range rlimits {
		m[l.Name] = l
	}
	for _, v := range m {
		res = append(res, v)
	}
	return res
}

type ReorderUsernameSource interface {
	LookupUsername(ctx context.Context, uid keybase1.UID) (libkb.NormalizedUsername, error)
}

// Reorder participants based on the order in activeList.
// Only allows usernames from tlfname in the output.
// This never fails, worse comes to worst it just returns the split of tlfname.
func ReorderParticipants(ctx context.Context, uloader ReorderUsernameSource, tlfname string, activeList []gregor1.UID) (writerNames []string, readerNames []string, err error) {
	srcWriterNames, srcReaderNames, _, err := splitAndNormalizeTLFNameCanonicalize(tlfname, false)
	if err != nil {
		return writerNames, readerNames, err
	}

	allowedWriters := make(map[string]bool)

	// Allow all writers from tlfname.
	for _, user := range srcWriterNames {
		allowedWriters[user] = true
	}

	// Fill from the active list first.
	for _, uid := range activeList {
		kbUID := keybase1.UID(uid.String())
		normalizedUsername, err := uloader.LookupUsername(ctx, kbUID)
		if err != nil {
			continue
		}
		user := normalizedUsername.String()
		user, err = normalizeAssertionOrName(user)
		if err != nil {
			continue
		}
		if allowed, _ := allowedWriters[user]; allowed {
			writerNames = append(writerNames, user)
			// Allow only one occurrence.
			allowedWriters[user] = false
		}
	}

	// Include participants even if they weren't in the active list, in stable order.
	for _, user := range srcWriterNames {
		if allowed, _ := allowedWriters[user]; allowed {
			writerNames = append(writerNames, user)
			allowedWriters[user] = false
		}
	}

	readerNames = srcReaderNames

	return writerNames, readerNames, nil
}

// Drive splitAndNormalizeTLFName with one attempt to follow TlfNameNotCanonical.
func splitAndNormalizeTLFNameCanonicalize(name string, public bool) (writerNames, readerNames []string, extensionSuffix string, err error) {
	writerNames, readerNames, extensionSuffix, err = splitAndNormalizeTLFName(name, public)
	if retryErr, retry := err.(TlfNameNotCanonical); retry {
		return splitAndNormalizeTLFName(retryErr.NameToTry, public)
	}
	return writerNames, readerNames, extensionSuffix, err
}

const (
	ChatTopicIDLen    = 16
	ChatTopicIDSuffix = 0x20
)

func NewChatTopicID() (id []byte, err error) {
	if id, err = libkb.RandBytes(ChatTopicIDLen); err != nil {
		return nil, err
	}
	id[len(id)-1] = ChatTopicIDSuffix
	return id, nil
}

func AllChatConversationStatuses() (res []chat1.ConversationStatus) {
	for _, s := range chat1.ConversationStatusMap {
		res = append(res, s)
	}
	sort.Sort(byConversationStatus(res))
	return
}

// ConversationStatusBehavior describes how a ConversationStatus behaves
type ConversationStatusBehavior struct {
	// Whether to show the conv in the inbox
	ShowInInbox bool
	// Whether sending to this conv sets it back to UNFILED
	SendingRemovesStatus bool
	// Whether any incoming activity sets it back to UNFILED
	ActivityRemovesStatus bool
	// Whether to show desktop notifications
	DesktopNotifications bool
	// Whether to send push notifications
	PushNotifications bool
	// Whether to show as part of badging
	ShowBadges bool
}

// When changing these, be sure to update gregor's postMessage as well
func GetConversationStatusBehavior(s chat1.ConversationStatus) ConversationStatusBehavior {
	switch s {
	case chat1.ConversationStatus_UNFILED:
		return ConversationStatusBehavior{
			ShowInInbox:           true,
			SendingRemovesStatus:  false,
			ActivityRemovesStatus: false,
			DesktopNotifications:  true,
			PushNotifications:     true,
			ShowBadges:            true,
		}
	case chat1.ConversationStatus_FAVORITE:
		return ConversationStatusBehavior{
			ShowInInbox:           true,
			SendingRemovesStatus:  false,
			ActivityRemovesStatus: false,
			DesktopNotifications:  true,
			PushNotifications:     true,
			ShowBadges:            true,
		}
	case chat1.ConversationStatus_IGNORED:
		return ConversationStatusBehavior{
			ShowInInbox:           false,
			SendingRemovesStatus:  true,
			ActivityRemovesStatus: true,
			DesktopNotifications:  true,
			PushNotifications:     true,
			ShowBadges:            true,
		}
	case chat1.ConversationStatus_BLOCKED:
		return ConversationStatusBehavior{
			ShowInInbox:           false,
			SendingRemovesStatus:  true,
			ActivityRemovesStatus: false,
			DesktopNotifications:  false,
			PushNotifications:     false,
			ShowBadges:            false,
		}
	case chat1.ConversationStatus_MUTED:
		return ConversationStatusBehavior{
			ShowInInbox:           true,
			SendingRemovesStatus:  false,
			ActivityRemovesStatus: false,
			DesktopNotifications:  false,
			PushNotifications:     false,
			ShowBadges:            false,
		}
	default:
		return ConversationStatusBehavior{
			ShowInInbox:           true,
			SendingRemovesStatus:  false,
			ActivityRemovesStatus: false,
			DesktopNotifications:  true,
			PushNotifications:     true,
			ShowBadges:            true,
		}
	}
}

type byConversationStatus []chat1.ConversationStatus

func (c byConversationStatus) Len() int           { return len(c) }
func (c byConversationStatus) Less(i, j int) bool { return c[i] < c[j] }
func (c byConversationStatus) Swap(i, j int)      { c[i], c[j] = c[j], c[i] }

// Which convs show in the inbox.
func VisibleChatConversationStatuses() (res []chat1.ConversationStatus) {
	for _, s := range chat1.ConversationStatusMap {
		if GetConversationStatusBehavior(s).ShowInInbox {
			res = append(res, s)
		}
	}
	sort.Sort(byConversationStatus(res))
	return
}

func VisibleChatMessageTypes() []chat1.MessageType {
	return []chat1.MessageType{
		chat1.MessageType_TEXT,
		chat1.MessageType_ATTACHMENT,
	}
}

func IsVisibleChatMessageType(messageType chat1.MessageType) bool {
	for _, mt := range VisibleChatMessageTypes() {
		if messageType == mt {
			return true
		}
	}
	return false
}

type DebugLabeler struct {
	libkb.Contextified
	label   string
	verbose bool
}

func NewDebugLabeler(g *libkb.GlobalContext, label string, verbose bool) DebugLabeler {
	return DebugLabeler{
		Contextified: libkb.NewContextified(g),
		label:        label,
		verbose:      verbose,
	}
}

func (d DebugLabeler) showVerbose() bool {
	return false
}

func (d DebugLabeler) showLog() bool {
	if d.verbose {
		return d.showVerbose()
	}
	return true
}

func (d DebugLabeler) Debug(ctx context.Context, msg string, args ...interface{}) {
	if d.showLog() {
		d.G().Log.CDebugf(ctx, "++Chat: | "+d.label+": "+msg, args...)
	}
}

func (d DebugLabeler) Trace(ctx context.Context, f func() error, msg string) func() {
	if d.showLog() {
		start := time.Now()
		d.G().Log.CDebugf(ctx, "++Chat: + %s: %s", d.label, msg)
		return func() {
			d.G().Log.CDebugf(ctx, "++Chat: - %s: %s -> %s (%v)", d.label, msg,
				libkb.ErrToOk(f()), time.Since(start))
		}
	}
	return func() {}
}

func GetUnverifiedConv(ctx context.Context, g *libkb.GlobalContext, uid gregor1.UID,
	convID chat1.ConversationID, useLocalData bool) (chat1.Conversation, *chat1.RateLimit, error) {

	inbox, ratelim, err := g.InboxSource.ReadUnverified(ctx, uid, useLocalData, &chat1.GetInboxQuery{
		ConvIDs: []chat1.ConversationID{convID},
	}, nil)
	if err != nil {
		return chat1.Conversation{}, ratelim, fmt.Errorf("GetUnverifiedConv: %s", err.Error())
	}
	if len(inbox.ConvsUnverified) == 0 {
		return chat1.Conversation{}, ratelim, fmt.Errorf("GetUnverifiedConv: no conv found: %s", convID)
	}
	return inbox.ConvsUnverified[0], ratelim, nil
}

// FilterByType filters messages based on a query.
// If includeAllErrors then MessageUnboxedError are all returned. Otherwise, they are filtered based on type.
// Messages whose type cannot be determined are considered errors.
func FilterByType(msgs []chat1.MessageUnboxed, query *chat1.GetThreadQuery, includeAllErrors bool) (res []chat1.MessageUnboxed) {
	useTypeFilter := (query != nil && len(query.MessageTypes) > 0)

	typmap := make(map[chat1.MessageType]bool)
	if useTypeFilter {
		for _, mt := range query.MessageTypes {
			typmap[mt] = true
		}
	}

	for _, msg := range msgs {
		state, err := msg.State()
		if err != nil {
			if includeAllErrors {
				res = append(res, msg)
			}
			continue
		}
		if includeAllErrors && state == chat1.MessageUnboxedState_ERROR {
			res = append(res, msg)
		} else {
			_, match := typmap[msg.GetMessageType()]
			if !useTypeFilter || match {
				res = append(res, msg)
			}
		}
	}
	return res
}

// GetSupersedes must be called with a valid msg
func GetSupersedes(msg chat1.MessageUnboxed) ([]chat1.MessageID, error) {
	body := msg.Valid().MessageBody
	typ, err := body.MessageType()
	if err != nil {
		return nil, err
	}

	// We use the message ID in the body over the field in the client header to avoid server trust.
	switch typ {
	case chat1.MessageType_EDIT:
		return []chat1.MessageID{msg.Valid().MessageBody.Edit().MessageID}, nil
	case chat1.MessageType_DELETE:
		return msg.Valid().MessageBody.Delete().MessageIDs, nil
	case chat1.MessageType_ATTACHMENTUPLOADED:
		return []chat1.MessageID{msg.Valid().MessageBody.Attachmentuploaded().MessageID}, nil
	default:
		return nil, nil
	}
}

func PluckMessageIDs(msgs []chat1.MessageSummary) []chat1.MessageID {
	res := make([]chat1.MessageID, len(msgs))
	for i, m := range msgs {
		res[i] = m.GetMessageID()
	}
	return res
}

func IsConvEmpty(conv chat1.Conversation) bool {
	for _, msg := range conv.MaxMsgSummaries {
		if IsVisibleChatMessageType(msg.GetMessageType()) {
			return false
		}
	}
	return true
}
