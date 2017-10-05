package utils

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"regexp"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/kbfs"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
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

func ParseTimeFromRFC3339OrDurationFromPast(g *globals.Context, s string) (t time.Time, err error) {
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
		user, err = kbfs.NormalizeAssertionOrName(user)
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
	writerNames, readerNames, extensionSuffix, err = kbfs.SplitAndNormalizeTLFName(name, public)
	if retryErr, retry := err.(kbfs.TlfNameNotCanonical); retry {
		return kbfs.SplitAndNormalizeTLFName(retryErr.NameToTry, public)
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

// GetConversationStatusBehavior gives information about what is allowed for a conversation status.
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
	case chat1.ConversationStatus_REPORTED:
		fallthrough
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
	log     logger.Logger
	label   string
	verbose bool
}

func NewDebugLabeler(log logger.Logger, label string, verbose bool) DebugLabeler {
	return DebugLabeler{
		log:     log,
		label:   label,
		verbose: verbose,
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
		d.log.CDebugf(ctx, "++Chat: | "+d.label+": "+msg, args...)
	}
}

func (d DebugLabeler) Trace(ctx context.Context, f func() error, msg string) func() {
	if d.showLog() {
		start := time.Now()
		d.log.CDebugf(ctx, "++Chat: + %s: %s", d.label, msg)
		return func() {
			d.log.CDebugf(ctx, "++Chat: - %s: %s -> %s (%v)", d.label, msg,
				libkb.ErrToOk(f()), time.Since(start))
		}
	}
	return func() {}
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

var atMentionRegExp = regexp.MustCompile(`\B@([a-z][a-z0-9_]+)`)

func ParseAtMentionsNames(ctx context.Context, body string) (res []string) {
	matches := atMentionRegExp.FindAllStringSubmatch(body, -1)
	for _, m := range matches {
		if len(m) >= 2 {
			res = append(res, m[1])
		}
	}
	return res
}

func ParseAtMentionedUIDs(ctx context.Context, body string, upak libkb.UPAKLoader, debug *DebugLabeler) (atRes []gregor1.UID, chanRes chat1.ChannelMention) {
	names := ParseAtMentionsNames(ctx, body)
	chanRes = chat1.ChannelMention_NONE
	for _, name := range names {

		switch name {
		case "channel", "everyone":
			chanRes = chat1.ChannelMention_ALL
			continue
		case "here":
			if chanRes != chat1.ChannelMention_ALL {
				chanRes = chat1.ChannelMention_HERE
			}
			continue
		default:
		}

		kuid, err := upak.LookupUID(ctx, libkb.NewNormalizedUsername(name))
		if err != nil {
			if debug != nil {
				debug.Debug(ctx, "ParseAtMentionedUIDs: failed to lookup UID for: %s msg: %s",
					name, err.Error())
			}
			continue
		}
		atRes = append(atRes, kuid.ToBytes())
	}
	return atRes, chanRes
}

func ParseAndDecorateAtMentionedUIDs(ctx context.Context, body string, upak libkb.UPAKLoader, debug *DebugLabeler) (newBody string, atRes []gregor1.UID, chanRes chat1.ChannelMention) {
	atRes, chanRes = ParseAtMentionedUIDs(ctx, body, upak, debug)
	newBody = atMentionRegExp.ReplaceAllStringFunc(body, func(m string) string {
		replace := false
		switch m {
		case "@channel", "@here", "@everyone":
			replace = true
		default:
			toks := strings.Split(m, "@")
			if len(toks) == 2 {
				_, err := upak.LookupUID(ctx, libkb.NewNormalizedUsername(toks[1]))
				if err == nil {
					replace = true
				}
			}
		}
		if replace {
			return fmt.Sprintf("`%s`", m)
		}
		return m
	})
	return newBody, atRes, chanRes
}

func PluckMessageIDs(msgs []chat1.MessageSummary) []chat1.MessageID {
	res := make([]chat1.MessageID, len(msgs))
	for i, m := range msgs {
		res[i] = m.GetMessageID()
	}
	return res
}

func IsConvEmpty(conv chat1.Conversation) bool {
	switch conv.GetMembersType() {
	case chat1.ConversationMembersType_TEAM:
		return false
	default:
		for _, msg := range conv.MaxMsgSummaries {
			if IsVisibleChatMessageType(msg.GetMessageType()) {
				return false
			}
		}
		return true
	}
}

func PluckConvIDsLocal(convs []chat1.ConversationLocal) (res []chat1.ConversationID) {
	for _, conv := range convs {
		res = append(res, conv.GetConvID())
	}
	return res
}

func PluckConvIDs(convs []chat1.Conversation) (res []chat1.ConversationID) {
	for _, conv := range convs {
		res = append(res, conv.GetConvID())
	}
	return res
}

func SanitizeTopicName(topicName string) string {
	return strings.TrimPrefix(topicName, "#")
}

func CreateTopicNameState(cmp chat1.ConversationIDMessageIDPairs) (chat1.TopicNameState, error) {
	var data []byte
	var err error
	mh := codec.MsgpackHandle{WriteExt: true}
	enc := codec.NewEncoderBytes(&data, &mh)
	if err = enc.Encode(cmp); err != nil {
		return chat1.TopicNameState{}, err
	}

	h := sha256.New()
	if _, err = h.Write(data); err != nil {
		return chat1.TopicNameState{}, err
	}

	return h.Sum(nil), nil
}

func GetConvMtime(conv chat1.Conversation) gregor1.Time {
	timeTyps := []chat1.MessageType{
		chat1.MessageType_TEXT,
		chat1.MessageType_ATTACHMENT,
	}
	var summaries []chat1.MessageSummary
	for _, typ := range timeTyps {
		summary, err := conv.GetMaxMessage(typ)
		if err == nil {
			summaries = append(summaries, summary)
		}
	}
	if len(summaries) == 0 {
		return conv.ReaderInfo.Mtime
	}
	sort.Sort(ByMsgSummaryCtime(summaries))
	return summaries[len(summaries)-1].Ctime
}

func PickLatestMessageUnboxed(conv chat1.ConversationLocal, typs []chat1.MessageType) (res chat1.MessageUnboxed, err error) {
	var msgs []chat1.MessageUnboxed
	for _, typ := range typs {
		msg, err := conv.GetMaxMessage(typ)
		if err == nil && msg.IsValid() {
			msgs = append(msgs, msg)
		}
	}
	if len(msgs) == 0 {
		return res, errors.New("no message found")
	}
	sort.Sort(ByMsgUnboxedCtime(msgs))
	return msgs[len(msgs)-1], nil
}

func GetConvMtimeLocal(conv chat1.ConversationLocal) gregor1.Time {
	timeTyps := []chat1.MessageType{
		chat1.MessageType_TEXT,
		chat1.MessageType_ATTACHMENT,
	}
	msg, err := PickLatestMessageUnboxed(conv, timeTyps)
	if err != nil {
		return conv.ReaderInfo.Mtime
	}
	return msg.Valid().ServerHeader.Ctime
}

func GetConvSnippet(conv chat1.ConversationLocal) string {
	timeTyps := []chat1.MessageType{
		chat1.MessageType_TEXT,
		chat1.MessageType_ATTACHMENT,
	}
	msg, err := PickLatestMessageUnboxed(conv, timeTyps)
	if err != nil {
		return ""
	}
	return GetMsgSnippet(msg)
}

func GetMsgSnippet(msg chat1.MessageUnboxed) string {
	switch msg.GetMessageType() {
	case chat1.MessageType_TEXT:
		return msg.Valid().MessageBody.Text().Body
	case chat1.MessageType_ATTACHMENT:
		return msg.Valid().MessageBody.Attachment().Object.Title
	}
	return ""
}

func PresentRemoteConversation(rc types.RemoteConversation) (res chat1.UnverifiedInboxUIItem) {
	rawConv := rc.Conv
	res.ConvID = rawConv.GetConvID().String()
	res.Name = rawConv.MaxMsgSummaries[0].TlfName
	res.Status = rawConv.Metadata.Status
	res.Time = GetConvMtime(rawConv)
	res.Visibility = rawConv.Metadata.Visibility
	res.Notifications = rawConv.Notifications
	res.MembersType = rawConv.GetMembersType()
	res.TeamType = rawConv.Metadata.TeamType
	res.Version = rawConv.Metadata.Version
	if rc.LocalMetadata != nil {
		res.LocalMetadata = &chat1.UnverifiedInboxUIItemMetadata{
			ChannelName:       rc.LocalMetadata.TopicName,
			Headline:          rc.LocalMetadata.Headline,
			Snippet:           rc.LocalMetadata.Snippet,
			WriterNames:       rc.LocalMetadata.WriterNames,
			ResetParticipants: rc.LocalMetadata.ResetParticipants,
		}
	}
	return res
}

func PresentRemoteConversations(rcs []types.RemoteConversation) (res []chat1.UnverifiedInboxUIItem) {
	for _, rc := range rcs {
		res = append(res, PresentRemoteConversation(rc))
	}
	return res
}

func PresentConversationLocal(rawConv chat1.ConversationLocal) (res chat1.InboxUIItem) {
	res.ConvID = rawConv.GetConvID().String()
	res.Name = rawConv.Info.TlfName
	res.Snippet = GetConvSnippet(rawConv)
	res.Channel = GetTopicName(rawConv)
	res.Headline = GetHeadline(rawConv)
	res.Participants = rawConv.Info.WriterNames
	res.ResetParticipants = rawConv.Info.ResetNames
	res.Status = rawConv.Info.Status
	res.MembersType = rawConv.GetMembersType()
	res.Visibility = rawConv.Info.Visibility
	res.Time = GetConvMtimeLocal(rawConv)
	res.FinalizeInfo = rawConv.GetFinalizeInfo()
	res.SupersededBy = rawConv.SupersededBy
	res.Supersedes = rawConv.Supersedes
	res.IsEmpty = rawConv.IsEmpty
	res.Notifications = rawConv.Notifications
	res.CreatorInfo = rawConv.CreatorInfo
	res.TeamType = rawConv.Info.TeamType
	res.Version = rawConv.Info.Version
	return res
}

func PresentConversationLocals(convs []chat1.ConversationLocal) (res []chat1.InboxUIItem) {
	for _, conv := range convs {
		res = append(res, PresentConversationLocal(conv))
	}
	return res
}

func PresentMessageUnboxed(rawMsg chat1.MessageUnboxed) (res chat1.UIMessage) {
	state, err := rawMsg.State()
	if err != nil {
		res = chat1.NewUIMessageWithError(chat1.MessageUnboxedError{
			ErrType:   chat1.MessageUnboxedErrorType_MISC,
			ErrMsg:    err.Error(),
			MessageID: rawMsg.GetMessageID(),
		})
		return res
	}
	switch state {
	case chat1.MessageUnboxedState_VALID:
		var strOutboxID *string
		if rawMsg.Valid().ClientHeader.OutboxID != nil {
			so := rawMsg.Valid().ClientHeader.OutboxID.String()
			strOutboxID = &so
		}
		res = chat1.NewUIMessageWithValid(chat1.UIMessageValid{
			MessageID:             rawMsg.GetMessageID(),
			Ctime:                 rawMsg.Valid().ServerHeader.Ctime,
			OutboxID:              strOutboxID,
			MessageBody:           rawMsg.Valid().MessageBody,
			SenderUsername:        rawMsg.Valid().SenderUsername,
			SenderDeviceName:      rawMsg.Valid().SenderDeviceName,
			SenderDeviceType:      rawMsg.Valid().SenderDeviceType,
			SenderDeviceRevokedAt: rawMsg.Valid().SenderDeviceRevokedAt,
			Superseded:            rawMsg.Valid().ServerHeader.SupersededBy != 0,
			AtMentions:            rawMsg.Valid().AtMentionUsernames,
			ChannelMention:        rawMsg.Valid().ChannelMention,
		})
	case chat1.MessageUnboxedState_OUTBOX:
		var body string
		typ := rawMsg.Outbox().Msg.ClientHeader.MessageType
		switch typ {
		case chat1.MessageType_TEXT:
			body = rawMsg.Outbox().Msg.MessageBody.Text().Body
		case chat1.MessageType_EDIT:
			body = rawMsg.Outbox().Msg.MessageBody.Edit().Body
		}
		res = chat1.NewUIMessageWithOutbox(chat1.UIMessageOutbox{
			State:       rawMsg.Outbox().State,
			OutboxID:    rawMsg.Outbox().OutboxID.String(),
			MessageType: typ,
			Body:        body,
			Ctime:       rawMsg.Outbox().Ctime,
		})
	case chat1.MessageUnboxedState_ERROR:
		res = chat1.NewUIMessageWithError(rawMsg.Error())
	case chat1.MessageUnboxedState_PLACEHOLDER:
		res = chat1.NewUIMessageWithPlaceholder(rawMsg.Placeholder())
	}
	return res
}

func PresentPagination(p *chat1.Pagination) (res *chat1.UIPagination) {
	if p == nil {
		return nil
	}
	res = new(chat1.UIPagination)
	res.Last = p.Last
	res.Num = p.Num
	res.Next = hex.EncodeToString(p.Next)
	res.Previous = hex.EncodeToString(p.Previous)
	return res
}

func DecodePagination(p *chat1.UIPagination) (res *chat1.Pagination, err error) {
	if p == nil {
		return nil, nil
	}
	res = new(chat1.Pagination)
	res.Last = p.Last
	res.Num = p.Num
	if res.Next, err = hex.DecodeString(p.Next); err != nil {
		return nil, err
	}
	if res.Previous, err = hex.DecodeString(p.Previous); err != nil {
		return nil, err
	}
	return res, nil
}

type ConvLocalByConvID []chat1.ConversationLocal

func (c ConvLocalByConvID) Len() int      { return len(c) }
func (c ConvLocalByConvID) Swap(i, j int) { c[i], c[j] = c[j], c[i] }
func (c ConvLocalByConvID) Less(i, j int) bool {
	return c[i].GetConvID().Less(c[j].GetConvID())
}

type ConvByConvID []chat1.Conversation

func (c ConvByConvID) Len() int      { return len(c) }
func (c ConvByConvID) Swap(i, j int) { c[i], c[j] = c[j], c[i] }
func (c ConvByConvID) Less(i, j int) bool {
	return c[i].GetConvID().Less(c[j].GetConvID())
}

type RemoteConvByConvID []types.RemoteConversation

func (c RemoteConvByConvID) Len() int      { return len(c) }
func (c RemoteConvByConvID) Swap(i, j int) { c[i], c[j] = c[j], c[i] }
func (c RemoteConvByConvID) Less(i, j int) bool {
	return c[i].GetConvID().Less(c[j].GetConvID())
}

type ConvLocalByTopicName []chat1.ConversationLocal

func (c ConvLocalByTopicName) Len() int      { return len(c) }
func (c ConvLocalByTopicName) Swap(i, j int) { c[i], c[j] = c[j], c[i] }
func (c ConvLocalByTopicName) Less(i, j int) bool {
	return GetTopicName(c[i]) < GetTopicName(c[j])
}

type ByConvID []chat1.ConversationID

func (c ByConvID) Len() int      { return len(c) }
func (c ByConvID) Swap(i, j int) { c[i], c[j] = c[j], c[i] }
func (c ByConvID) Less(i, j int) bool {
	return c[i].Less(c[j])
}

type ByMsgSummaryCtime []chat1.MessageSummary

func (c ByMsgSummaryCtime) Len() int      { return len(c) }
func (c ByMsgSummaryCtime) Swap(i, j int) { c[i], c[j] = c[j], c[i] }
func (c ByMsgSummaryCtime) Less(i, j int) bool {
	return c[i].Ctime.Before(c[j].Ctime)
}

type ByMsgUnboxedCtime []chat1.MessageUnboxed

func (c ByMsgUnboxedCtime) Len() int      { return len(c) }
func (c ByMsgUnboxedCtime) Swap(i, j int) { c[i], c[j] = c[j], c[i] }
func (c ByMsgUnboxedCtime) Less(i, j int) bool {
	return c[i].Valid().ServerHeader.Ctime.Before(c[j].Valid().ServerHeader.Ctime)
}

func GetTopicName(conv chat1.ConversationLocal) string {
	maxTopicMsg, err := conv.GetMaxMessage(chat1.MessageType_METADATA)
	if err != nil {
		return ""
	}
	if !maxTopicMsg.IsValid() {
		return ""
	}
	return maxTopicMsg.Valid().MessageBody.Metadata().ConversationTitle
}

func GetHeadline(conv chat1.ConversationLocal) string {
	maxTopicMsg, err := conv.GetMaxMessage(chat1.MessageType_HEADLINE)
	if err != nil {
		return ""
	}
	if !maxTopicMsg.IsValid() {
		return ""
	}
	return maxTopicMsg.Valid().MessageBody.Headline().Headline
}

func NotificationInfoSet(settings *chat1.ConversationNotificationInfo,
	apptype keybase1.DeviceType,
	kind chat1.NotificationKind, enabled bool) {
	if settings.Settings == nil {
		settings.Settings = make(map[keybase1.DeviceType]map[chat1.NotificationKind]bool)
	}
	if settings.Settings[apptype] == nil {
		settings.Settings[apptype] = make(map[chat1.NotificationKind]bool)
	}
	settings.Settings[apptype][kind] = enabled
}

func DecodeBase64(enc []byte) ([]byte, error) {
	if len(enc) == 0 {
		return enc, nil
	}

	b := make([]byte, base64.StdEncoding.DecodedLen(len(enc)))
	n, err := base64.StdEncoding.Decode(b, enc)
	return b[:n], err
}

func RemoteConvs(convs []chat1.Conversation) (res []types.RemoteConversation) {
	for _, conv := range convs {
		res = append(res, types.RemoteConversation{
			Conv: conv,
		})
	}
	return res
}

func PluckConvs(rcs []types.RemoteConversation) (res []chat1.Conversation) {
	for _, rc := range rcs {
		res = append(res, rc.Conv)
	}
	return res
}

func SplitTLFName(tlfName string) []string {
	return strings.Split(strings.Fields(tlfName)[0], ",")
}
