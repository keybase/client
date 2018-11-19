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

	emoji "gopkg.in/kyokomi/emoji.v1"

	"github.com/keybase/client/go/chat/pager"
	"github.com/keybase/client/go/chat/unfurl/display"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"

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

func AssertLoggedInUID(ctx context.Context, g *globals.Context) (uid gregor1.UID, err error) {
	if !g.ActiveDevice.HaveKeys() {
		return uid, libkb.LoginRequiredError{}
	}
	k1uid := g.Env.GetUID()
	if k1uid.IsNil() {
		return uid, libkb.LoginRequiredError{}
	}
	return gregor1.UID(k1uid.ToBytes()), nil
}

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

// ReorderParticipants based on the order in activeList.
// Only allows usernames from tlfname in the output.
// This never fails, worse comes to worst it just returns the split of tlfname.
func ReorderParticipants(mctx libkb.MetaContext, g libkb.UIDMapperContext, umapper libkb.UIDMapper,
	tlfname string, activeList []gregor1.UID) (writerNames []chat1.ConversationLocalParticipant, err error) {
	srcWriterNames, _, _, err := splitAndNormalizeTLFNameCanonicalize(mctx.G(), tlfname, false)
	if err != nil {
		return writerNames, err
	}
	var activeKuids []keybase1.UID
	for _, a := range activeList {
		activeKuids = append(activeKuids, keybase1.UID(a.String()))
	}
	packages, err := umapper.MapUIDsToUsernamePackages(mctx.Ctx(), g, activeKuids, time.Hour*24, 10*time.Second,
		true)
	activeMap := make(map[string]chat1.ConversationLocalParticipant)
	if err == nil {
		for i := 0; i < len(activeKuids); i++ {
			activeMap[activeKuids[i].String()] = UsernamePackageToParticipant(packages[i])
		}
	}
	allowedWriters := make(map[string]bool)

	// Allow all writers from tlfname.
	for _, user := range srcWriterNames {
		allowedWriters[user] = true
	}

	// Fill from the active list first.
	for _, uid := range activeList {
		kbUID := keybase1.UID(uid.String())
		p, ok := activeMap[kbUID.String()]
		if !ok {
			continue
		}
		if allowed, _ := allowedWriters[p.Username]; allowed {
			writerNames = append(writerNames, p)
			// Allow only one occurrence.
			allowedWriters[p.Username] = false
		}
	}

	// Include participants even if they weren't in the active list, in stable order.
	for _, user := range srcWriterNames {
		if allowed, _ := allowedWriters[user]; allowed {
			writerNames = append(writerNames, UsernamePackageToParticipant(libkb.UsernamePackage{
				NormalizedUsername: libkb.NewNormalizedUsername(user),
				FullName:           nil,
			}))
			allowedWriters[user] = false
		}
	}

	return writerNames, nil
}

// Drive splitAndNormalizeTLFName with one attempt to follow TlfNameNotCanonical.
func splitAndNormalizeTLFNameCanonicalize(g *libkb.GlobalContext, name string, public bool) (writerNames, readerNames []string, extensionSuffix string, err error) {
	writerNames, readerNames, extensionSuffix, err = kbfs.SplitAndNormalizeTLFName(g, name, public)
	if retryErr, retry := err.(kbfs.TlfNameNotCanonical); retry {
		return kbfs.SplitAndNormalizeTLFName(g, retryErr.NameToTry, public)
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

// ConversationMemberStatusBehavior describes how a ConversationMemberStatus behaves
type ConversationMemberStatusBehavior struct {
	// Whether to show the conv in the inbox
	ShowInInbox bool
	// Whether to show desktop notifications
	DesktopNotifications bool
	// Whether to send push notifications
	PushNotifications bool
	// Whether to show as part of badging
	ShowBadges bool
}

func GetConversationMemberStatusBehavior(s chat1.ConversationMemberStatus) ConversationMemberStatusBehavior {
	switch s {
	case chat1.ConversationMemberStatus_ACTIVE:
		return ConversationMemberStatusBehavior{
			ShowInInbox:          true,
			DesktopNotifications: true,
			PushNotifications:    true,
			ShowBadges:           true,
		}
	case chat1.ConversationMemberStatus_PREVIEW:
		return ConversationMemberStatusBehavior{
			ShowInInbox:          true,
			DesktopNotifications: true,
			PushNotifications:    true,
			ShowBadges:           true,
		}
	case chat1.ConversationMemberStatus_LEFT:
		return ConversationMemberStatusBehavior{
			ShowInInbox:          false,
			DesktopNotifications: false,
			PushNotifications:    false,
			ShowBadges:           false,
		}
	case chat1.ConversationMemberStatus_REMOVED:
		return ConversationMemberStatusBehavior{
			ShowInInbox:          false,
			DesktopNotifications: false,
			PushNotifications:    false,
			ShowBadges:           false,
		}
	case chat1.ConversationMemberStatus_RESET:
		return ConversationMemberStatusBehavior{
			ShowInInbox:          true,
			DesktopNotifications: false,
			PushNotifications:    false,
			ShowBadges:           false,
		}
	default:
		return ConversationMemberStatusBehavior{
			ShowInInbox:          true,
			DesktopNotifications: true,
			PushNotifications:    true,
			ShowBadges:           true,
		}
	}
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

func IsVisibleChatMessageType(messageType chat1.MessageType) bool {
	for _, mt := range chat1.VisibleChatMessageTypes() {
		if messageType == mt {
			return true
		}
	}
	return false
}

func IsNotifiableChatMessageType(messageType chat1.MessageType, atMentions []gregor1.UID,
	chanMention chat1.ChannelMention) bool {
	if IsVisibleChatMessageType(messageType) {
		return true
	}
	switch messageType {
	case chat1.MessageType_EDIT:
		// an edit with atMention or channel mention should generate notifications
		if len(atMentions) > 0 || chanMention != chat1.ChannelMention_NONE {
			return true
		}
	case chat1.MessageType_REACTION:
		// effect of this is all reactions will notify if they are sent to a person that
		// is notified for any messages in the conversation
		return true
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
		log:     log.CloneWithAddedDepth(1),
		label:   label,
		verbose: verbose,
	}
}

func (d DebugLabeler) GetLog() logger.Logger {
	return d.log
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

func (d DebugLabeler) Trace(ctx context.Context, f func() error, format string, args ...interface{}) func() {
	if d.showLog() {
		msg := fmt.Sprintf(format, args...)
		start := time.Now()
		d.log.CDebugf(ctx, "++Chat: + %s: %s", d.label, msg)
		return func() {
			d.log.CDebugf(ctx, "++Chat: - %s: %s -> %s [time=%v]", d.label, msg,
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
		switch state {
		case chat1.MessageUnboxedState_ERROR:
			if includeAllErrors {
				res = append(res, msg)
			}
		case chat1.MessageUnboxedState_PLACEHOLDER:
			// We don't know what the type is for these, so just include them
			res = append(res, msg)
		default:
			_, match := typmap[msg.GetMessageType()]
			if !useTypeFilter || match {
				res = append(res, msg)
			}
		}
	}
	return res
}

// Filter messages that are both exploded that are no longer shown in the GUI
// (as ash lines)
func FilterExploded(conv types.UnboxConversationInfo, msgs []chat1.MessageUnboxed, now time.Time) (res []chat1.MessageUnboxed) {
	for _, msg := range msgs {
		if msg.IsValid() {
			mvalid := msg.Valid()
			if mvalid.IsEphemeral() && mvalid.HideExplosion(conv.GetMaxDeletedUpTo(), now) {
				continue
			}
		} else if msg.IsError() {
			// If we had an error on an expired message, it's irrelevant now
			// that the message has exploded so we hide it.
			merr := msg.Error()
			if merr.IsEphemeral && merr.IsEphemeralExpired {
				continue
			}
		}
		res = append(res, msg)
	}
	return res
}

func GetReaction(msg chat1.MessageUnboxed) (string, error) {
	if !msg.IsValid() {
		return "", errors.New("invalid message")
	}
	body := msg.Valid().MessageBody
	typ, err := body.MessageType()
	if err != nil {
		return "", err
	}
	if typ != chat1.MessageType_REACTION {
		return "", fmt.Errorf("not a reaction type: %v", typ)
	}
	return body.Reaction().Body, nil
}

// GetSupersedes must be called with a valid msg
func GetSupersedes(msg chat1.MessageUnboxed) ([]chat1.MessageID, error) {
	if !msg.IsValidFull() {
		return nil, fmt.Errorf("GetSupersedes called with invalid message: %v", msg.GetMessageID())
	}
	body := msg.Valid().MessageBody
	typ, err := body.MessageType()
	if err != nil {
		return nil, err
	}

	// We use the message ID in the body over the field in the client header to
	// avoid server trust.
	switch typ {
	case chat1.MessageType_EDIT:
		return []chat1.MessageID{msg.Valid().MessageBody.Edit().MessageID}, nil
	case chat1.MessageType_REACTION:
		return []chat1.MessageID{msg.Valid().MessageBody.Reaction().MessageID}, nil
	case chat1.MessageType_DELETE:
		return msg.Valid().MessageBody.Delete().MessageIDs, nil
	case chat1.MessageType_ATTACHMENTUPLOADED:
		return []chat1.MessageID{msg.Valid().MessageBody.Attachmentuploaded().MessageID}, nil
	case chat1.MessageType_UNFURL:
		return []chat1.MessageID{msg.Valid().MessageBody.Unfurl().MessageID}, nil
	default:
		return nil, nil
	}
}

var chanNameMentionRegExp = regexp.MustCompile(`\B#([0-9a-zA-Z_-]+)`)

func ParseChannelNameMentions(ctx context.Context, body string, uid gregor1.UID, teamID chat1.TLFID,
	ts types.TeamChannelSource) (res []chat1.ChannelNameMention) {
	names := parseRegexpNames(ctx, body, chanNameMentionRegExp)
	if len(names) == 0 {
		return nil
	}
	chanResponse, err := ts.GetChannelsTopicName(ctx, uid, teamID, chat1.TopicType_CHAT)
	if err != nil {
		return nil
	}
	validChans := make(map[string]chat1.ChannelNameMention)
	for _, cr := range chanResponse {
		validChans[cr.TopicName] = cr
	}
	for _, name := range names {
		if cr, ok := validChans[name]; ok {
			res = append(res, cr)
		}
	}
	return res
}

var atMentionRegExp = regexp.MustCompile(`\B@([a-z0-9][a-z0-9_]+)`)

func parseRegexpNames(ctx context.Context, body string, re *regexp.Regexp) (res []string) {
	matches := re.FindAllStringSubmatch(body, -1)
	for _, m := range matches {
		if len(m) >= 2 {
			res = append(res, m[1])
		}
	}
	return res
}

func ParseAtMentionsNames(ctx context.Context, body string) (res []string) {
	return parseRegexpNames(ctx, body, atMentionRegExp)
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

type SystemMessageUIDSource interface {
	LookupUID(ctx context.Context, un libkb.NormalizedUsername) (keybase1.UID, error)
}

func SystemMessageMentions(ctx context.Context, body chat1.MessageSystem, upak SystemMessageUIDSource) (atMentions []gregor1.UID, chanMention chat1.ChannelMention) {
	typ, err := body.SystemType()
	if err != nil {
		return atMentions, chanMention
	}
	switch typ {
	case chat1.MessageSystemType_ADDEDTOTEAM:
		addeeUID, err := upak.LookupUID(ctx, libkb.NewNormalizedUsername(body.Addedtoteam().Addee))
		if err == nil {
			atMentions = append(atMentions, addeeUID.ToBytes())
		}
	case chat1.MessageSystemType_INVITEADDEDTOTEAM:
		inviteeUID, err := upak.LookupUID(ctx, libkb.NewNormalizedUsername(body.Inviteaddedtoteam().Invitee))
		if err == nil {
			atMentions = append(atMentions, inviteeUID.ToBytes())
		}
		inviterUID, err := upak.LookupUID(ctx, libkb.NewNormalizedUsername(body.Inviteaddedtoteam().Inviter))
		if err == nil {
			atMentions = append(atMentions, inviterUID.ToBytes())
		}
	case chat1.MessageSystemType_COMPLEXTEAM:
		chanMention = chat1.ChannelMention_ALL
	}
	sort.Sort(chat1.ByUID(atMentions))
	return atMentions, chanMention
}

func PluckMessageIDs(msgs []chat1.MessageSummary) []chat1.MessageID {
	res := make([]chat1.MessageID, len(msgs))
	for i, m := range msgs {
		res[i] = m.GetMessageID()
	}
	return res
}

func PluckUIMessageIDs(msgs []chat1.UIMessage) (res []chat1.MessageID) {
	for _, m := range msgs {
		res = append(res, m.GetMessageID())
	}
	return res
}

func PluckMUMessageIDs(msgs []chat1.MessageUnboxed) (res []chat1.MessageID) {
	for _, m := range msgs {
		res = append(res, m.GetMessageID())
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

func PluckConvIDsRC(convs []types.RemoteConversation) (res []chat1.ConversationID) {
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
	var summaries []chat1.MessageSummary
	for _, typ := range chat1.VisibleChatMessageTypes() {
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

func PickLatestMessageSummary(conv chat1.Conversation, typs []chat1.MessageType) (res chat1.MessageSummary, err error) {
	// nil means all
	if typs == nil {
		for typ := range chat1.MessageTypeRevMap {
			typs = append(typs, typ)
		}
	}
	for _, typ := range typs {
		msg, err := conv.GetMaxMessage(typ)
		if err == nil && msg.Ctime.After(res.Ctime) {
			res = msg
		}
	}
	if res.GetMessageID() == 0 {
		return res, errors.New("no message summary found")
	}
	return res, nil
}

// PickLatestMessageUnboxed gets the latest message with one `typs`.
// This method can return deleted messages which have a blank body.
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
	msg, err := PickLatestMessageUnboxed(conv, chat1.VisibleChatMessageTypes())
	if err != nil {
		return conv.ReaderInfo.Mtime
	}
	return msg.Valid().ServerHeader.Ctime
}

func GetConvSnippet(conv chat1.ConversationLocal, currentUsername string) (snippet, decoration string) {
	msg, err := PickLatestMessageUnboxed(conv,
		append(chat1.VisibleChatMessageTypes(), chat1.MessageType_DELETEHISTORY))
	// If a DELETEHISTORY is the latest message, there is no snippet
	if err != nil || msg.GetMessageType() == chat1.MessageType_DELETEHISTORY {
		return "", ""
	}
	return GetMsgSnippet(msg, conv, currentUsername)
}

func GetMsgSummaryByType(msgs []chat1.MessageSummary, typ chat1.MessageType) (chat1.MessageSummary, error) {
	for _, msg := range msgs {
		if msg.GetMessageType() == typ {
			return msg, nil
		}
	}
	return chat1.MessageSummary{}, errors.New("not found")
}

func systemMessageSnippet(msg chat1.MessageSystem) string {
	typ, err := msg.SystemType()
	if err != nil {
		return ""
	}
	switch typ {
	case chat1.MessageSystemType_ADDEDTOTEAM:
		return fmt.Sprintf("%s added to team", msg.Addedtoteam().Addee)
	case chat1.MessageSystemType_COMPLEXTEAM:
		return fmt.Sprintf("%s converted to big team", msg.Complexteam().Team)
	case chat1.MessageSystemType_INVITEADDEDTOTEAM:
		return fmt.Sprintf("%s added to team", msg.Inviteaddedtoteam().Invitee)
	case chat1.MessageSystemType_GITPUSH:
		return fmt.Sprintf("%s pushed to %s", msg.Gitpush().Pusher, msg.Gitpush().RepoName)
	case chat1.MessageSystemType_CHANGEAVATAR:
		return fmt.Sprintf("%s changed team avatar", msg.Changeavatar().User)
	default:
		return ""
	}
}

func showSenderPrefix(mvalid chat1.MessageUnboxedValid, conv chat1.ConversationLocal) (showPrefix bool) {
	switch conv.GetMembersType() {
	case chat1.ConversationMembersType_TEAM:
		showPrefix = true
	default:
		showPrefix = len(conv.Names()) > 2
	}
	return showPrefix
}

// Sender prefix for msg snippets. Will show if a conversation has > 2 members
// or is of type TEAM
func getSenderPrefix(mvalid chat1.MessageUnboxedValid, conv chat1.ConversationLocal, currentUsername string) (senderPrefix string) {
	if showSenderPrefix(mvalid, conv) {
		sender := mvalid.SenderUsername
		if sender == currentUsername {
			senderPrefix = "You: "
		} else {
			senderPrefix = fmt.Sprintf("%s: ", sender)
		}
	}
	return senderPrefix
}

func GetMsgSnippet(msg chat1.MessageUnboxed, conv chat1.ConversationLocal, currentUsername string) (snippet, decoration string) {
	if !msg.IsValid() {
		return "", ""
	}

	mvalid := msg.Valid()
	senderPrefix := getSenderPrefix(mvalid, conv, currentUsername)

	if !msg.IsValidFull() {
		if mvalid.IsEphemeral() && mvalid.IsEphemeralExpired(time.Now()) {
			return fmt.Sprintf("%s ----------------------------", senderPrefix), "💥"
		}
		return "", ""
	}
	if mvalid.IsEphemeral() {
		decoration = "💣"
	}

	switch msg.GetMessageType() {
	case chat1.MessageType_TEXT:
		return senderPrefix + msg.Valid().MessageBody.Text().Body, decoration
	case chat1.MessageType_ATTACHMENT:
		obj := msg.Valid().MessageBody.Attachment().Object
		title := obj.Title
		if len(title) == 0 {
			atyp, err := obj.Metadata.AssetType()
			if err != nil {
				return senderPrefix + "???", decoration
			}
			switch atyp {
			case chat1.AssetMetadataType_IMAGE:
				title = "📷 attachment"
			case chat1.AssetMetadataType_VIDEO:
				title = "🎞 attachment"
			default:
				title = obj.Filename
			}
		}
		return senderPrefix + title, decoration
	case chat1.MessageType_SYSTEM:
		return systemMessageSnippet(msg.Valid().MessageBody.System()), decoration
	case chat1.MessageType_REQUESTPAYMENT:
		return "🚀 payment request", ""
	case chat1.MessageType_SENDPAYMENT:
		return "🚀 payment sent", ""
	}
	return "", ""
}

// We don't want to display the contents of an exploding message in notifications
func GetDesktopNotificationSnippet(conv *chat1.ConversationLocal, currentUsername string) string {
	if conv == nil {
		return ""
	}
	msg, err := PickLatestMessageUnboxed(*conv,
		append(chat1.VisibleChatMessageTypes(), chat1.MessageType_REACTION))
	if err != nil || !msg.IsValid() {
		return ""
	}
	mvalid := msg.Valid()
	var snippet string
	if !mvalid.IsEphemeral() {
		switch msg.GetMessageType() {
		case chat1.MessageType_REACTION:
			reaction, err := GetReaction(msg)
			if err != nil {
				snippet = ""
			} else {
				var prefix string
				if showSenderPrefix(mvalid, *conv) {
					prefix = mvalid.SenderUsername + " "
				}
				snippet = emoji.Sprintf("%sreacted to your message with %v", prefix, reaction)
			}
		default:
			snippet, _ = GetMsgSnippet(msg, *conv, currentUsername)
		}
		return snippet
	}

	// If the message is already exploded, nothing to see here.
	if !msg.IsValidFull() {
		return ""
	}
	switch msg.GetMessageType() {
	case chat1.MessageType_TEXT, chat1.MessageType_ATTACHMENT:
		return "💣 exploding message."
	default:
		return ""
	}
}

func PresentRemoteConversation(rc types.RemoteConversation) (res chat1.UnverifiedInboxUIItem) {
	var tlfName string
	rawConv := rc.Conv
	latest, err := PickLatestMessageSummary(rawConv, nil)
	if err != nil {
		tlfName = ""
	} else {
		tlfName = latest.TlfName
	}
	res.ConvID = rawConv.GetConvID().String()
	res.TopicType = rawConv.GetTopicType()
	res.Name = tlfName
	res.Status = rawConv.Metadata.Status
	res.Time = GetConvMtime(rawConv)
	res.Visibility = rawConv.Metadata.Visibility
	res.Notifications = rawConv.Notifications
	res.MembersType = rawConv.GetMembersType()
	res.MemberStatus = rawConv.ReaderInfo.Status
	res.TeamType = rawConv.Metadata.TeamType
	res.Version = rawConv.Metadata.Version
	res.ReadMsgID = rawConv.ReaderInfo.ReadMsgid
	res.MaxMsgID = rawConv.ReaderInfo.MaxMsgid
	res.Supersedes = rawConv.Metadata.Supersedes
	res.SupersededBy = rawConv.Metadata.SupersededBy
	res.FinalizeInfo = rawConv.Metadata.FinalizeInfo
	if rc.LocalMetadata != nil {
		res.LocalMetadata = &chat1.UnverifiedInboxUIItemMetadata{
			ChannelName:       rc.LocalMetadata.TopicName,
			Headline:          rc.LocalMetadata.Headline,
			Snippet:           rc.LocalMetadata.Snippet,
			SnippetDecoration: rc.LocalMetadata.SnippetDecoration,
			WriterNames:       rc.LocalMetadata.WriterNames,
			ResetParticipants: rc.LocalMetadata.ResetParticipants,
		}
		res.Name = rc.LocalMetadata.Name
	}
	return res
}

func PresentRemoteConversations(rcs []types.RemoteConversation) (res []chat1.UnverifiedInboxUIItem) {
	for _, rc := range rcs {
		res = append(res, PresentRemoteConversation(rc))
	}
	return res
}

func PresentConversationErrorLocal(rawConv chat1.ConversationErrorLocal) (res chat1.InboxUIItemError) {
	res.Message = rawConv.Message
	res.RekeyInfo = rawConv.RekeyInfo
	res.RemoteConv = PresentRemoteConversation(types.RemoteConversation{
		Conv: rawConv.RemoteConv,
	})
	res.Typ = rawConv.Typ
	res.UnverifiedTLFName = rawConv.UnverifiedTLFName
	return res
}

func PresentConversationLocal(rawConv chat1.ConversationLocal, currentUsername string) (res chat1.InboxUIItem) {
	var writerNames []string
	fullNames := make(map[string]string)
	for _, p := range rawConv.Info.Participants {
		writerNames = append(writerNames, p.Username)
		if p.Fullname != nil {
			fullNames[p.Username] = *p.Fullname
		}
	}
	res.ConvID = rawConv.GetConvID().String()
	res.TopicType = rawConv.GetTopicType()
	res.Name = rawConv.Info.TlfName
	res.Snippet, res.SnippetDecoration = GetConvSnippet(rawConv, currentUsername)
	res.Channel = GetTopicName(rawConv)
	res.Headline = GetHeadline(rawConv)
	res.Participants = writerNames
	res.FullNames = fullNames
	res.ResetParticipants = rawConv.Info.ResetNames
	res.Status = rawConv.Info.Status
	res.MembersType = rawConv.GetMembersType()
	res.MemberStatus = rawConv.Info.MemberStatus
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
	res.MaxMsgID = rawConv.ReaderInfo.MaxMsgid
	res.ReadMsgID = rawConv.ReaderInfo.ReadMsgid
	res.ConvRetention = rawConv.ConvRetention
	res.TeamRetention = rawConv.TeamRetention
	res.ConvSettings = rawConv.ConvSettings
	return res
}

func PresentConversationLocals(convs []chat1.ConversationLocal, currentUsername string) (res []chat1.InboxUIItem) {
	for _, conv := range convs {
		res = append(res, PresentConversationLocal(conv, currentUsername))
	}
	return res
}

func PresentThreadView(ctx context.Context, g *globals.Context, uid gregor1.UID, tv chat1.ThreadView,
	convID chat1.ConversationID) (res chat1.UIMessages) {
	res.Pagination = PresentPagination(tv.Pagination)
	for _, msg := range tv.Messages {
		res.Messages = append(res.Messages, PresentMessageUnboxed(ctx, g, msg, uid, convID))
	}
	return res
}

func computeOutboxOrdinal(obr chat1.OutboxRecord) float64 {
	return float64(obr.Msg.ClientHeader.OutboxInfo.Prev) + float64(obr.Ordinal)/1000.0
}

func PresentChannelNameMentions(ctx context.Context, crs []chat1.ChannelNameMention) (res []chat1.UIChannelNameMention) {
	for _, cr := range crs {
		res = append(res, chat1.UIChannelNameMention{
			Name:   cr.TopicName,
			ConvID: cr.ConvID.String(),
		})
	}
	return res
}

func formatVideoDuration(ms int) string {
	s := ms / 1000
	// see if we have hours
	if s >= 3600 {
		hours := s / 3600
		minutes := (s % 3600) / 60
		seconds := s - (hours*3600 + minutes*60)
		return fmt.Sprintf("%d:%02d:%02d", hours, minutes, seconds)
	}
	minutes := s / 60
	seconds := s % 60
	return fmt.Sprintf("%d:%02d", minutes, seconds)
}

func formatVideoSize(bytes int64) string {
	const (
		BYTE = 1.0 << (10 * iota)
		KILOBYTE
		MEGABYTE
		GIGABYTE
		TERABYTE
	)
	unit := ""
	value := float64(bytes)
	switch {
	case bytes >= TERABYTE:
		unit = "TB"
		value = value / TERABYTE
	case bytes >= GIGABYTE:
		unit = "GB"
		value = value / GIGABYTE
	case bytes >= MEGABYTE:
		unit = "MB"
		value = value / MEGABYTE
	case bytes >= KILOBYTE:
		unit = "KB"
		value = value / KILOBYTE
	case bytes >= BYTE:
		unit = "B"
	case bytes == 0:
		return "0"
	}
	return fmt.Sprintf("%.02f%s", value, unit)
}

func presentAttachmentAssetInfo(ctx context.Context, g *globals.Context, msg chat1.MessageUnboxed,
	convID chat1.ConversationID) *chat1.UIAssetUrlInfo {
	body := msg.Valid().MessageBody
	typ, err := body.MessageType()
	if err != nil {
		return nil
	}
	switch typ {
	case chat1.MessageType_ATTACHMENT, chat1.MessageType_ATTACHMENTUPLOADED:
		var hasFullURL, hasPreviewURL bool
		var asset chat1.Asset
		var info chat1.UIAssetUrlInfo
		if typ == chat1.MessageType_ATTACHMENT {
			asset = body.Attachment().Object
			info.MimeType = asset.MimeType
			hasFullURL = asset.Path != ""
			hasPreviewURL = body.Attachment().Preview != nil &&
				body.Attachment().Preview.Path != ""
		} else {
			asset = body.Attachmentuploaded().Object
			info.MimeType = asset.MimeType
			hasFullURL = asset.Path != ""
			hasPreviewURL = len(body.Attachmentuploaded().Previews) > 0 &&
				body.Attachmentuploaded().Previews[0].Path != ""
		}
		if hasFullURL {
			var cached bool
			info.FullUrl = g.AttachmentURLSrv.GetURL(ctx, convID, msg.GetMessageID(), false)
			cached, err = g.AttachmentURLSrv.GetAttachmentFetcher().IsAssetLocal(ctx, asset)
			if err != nil {
				cached = false
			}
			info.FullUrlCached = cached
		}
		if hasPreviewURL {
			info.PreviewUrl = g.AttachmentURLSrv.GetURL(ctx, convID, msg.GetMessageID(), true)
		}
		atyp, err := asset.Metadata.AssetType()
		if err == nil && atyp == chat1.AssetMetadataType_VIDEO && strings.HasPrefix(info.MimeType, "video") {
			if asset.Metadata.Video().DurationMs > 1 {
				info.VideoDuration = new(string)
				*info.VideoDuration = formatVideoDuration(asset.Metadata.Video().DurationMs) + ", " +
					formatVideoSize(asset.Size)
			}
			info.InlineVideoPlayable = true
		}
		if info.FullUrl == "" && info.PreviewUrl == "" && info.MimeType == "" {
			return nil
		}
		return &info
	}
	return nil
}

func presentPaymentInfo(ctx context.Context, g *globals.Context, msgID chat1.MessageID,
	convID chat1.ConversationID, msg chat1.MessageUnboxedValid) *chat1.UIPaymentInfo {

	typ, err := msg.MessageBody.MessageType()
	if err != nil {
		return nil
	}
	switch typ {
	case chat1.MessageType_SENDPAYMENT:
		body := msg.MessageBody.Sendpayment()
		return g.StellarLoader.LoadPayment(ctx, convID, msgID, msg.SenderUsername, body.PaymentID)
	}
	return nil
}

func presentRequestInfo(ctx context.Context, g *globals.Context, msgID chat1.MessageID,
	convID chat1.ConversationID, msg chat1.MessageUnboxedValid) *chat1.UIRequestInfo {

	typ, err := msg.MessageBody.MessageType()
	if err != nil {
		return nil
	}
	switch typ {
	case chat1.MessageType_REQUESTPAYMENT:
		body := msg.MessageBody.Requestpayment()
		return g.StellarLoader.LoadRequest(ctx, convID, msgID, msg.SenderUsername, body.RequestID)
	}
	return nil
}

func PresentUnfurl(ctx context.Context, g *globals.Context, convID chat1.ConversationID, u chat1.Unfurl) *chat1.UnfurlDisplay {
	ud, err := display.DisplayUnfurl(ctx, g.AttachmentURLSrv, convID, u)
	if err != nil {
		return nil
	}
	return &ud
}

func PresentUnfurls(ctx context.Context, g *globals.Context, convID chat1.ConversationID,
	unfurls map[chat1.MessageID]chat1.UnfurlResult) (res []chat1.UIMessageUnfurlInfo) {
	for unfurlMessageID, u := range unfurls {
		ud := PresentUnfurl(ctx, g, convID, u.Unfurl)
		if ud != nil {
			res = append(res, chat1.UIMessageUnfurlInfo{
				Unfurl:          *ud,
				UnfurlMessageID: unfurlMessageID,
				Url:             u.Url,
			})
		}
	}
	return res
}

func PresentMessageUnboxed(ctx context.Context, g *globals.Context, rawMsg chat1.MessageUnboxed,
	uid gregor1.UID, convID chat1.ConversationID) (res chat1.UIMessage) {

	miscErr := func(err error) chat1.UIMessage {
		return chat1.NewUIMessageWithError(chat1.MessageUnboxedError{
			ErrType:   chat1.MessageUnboxedErrorType_MISC,
			ErrMsg:    err.Error(),
			MessageID: rawMsg.GetMessageID(),
		})
	}

	state, err := rawMsg.State()
	if err != nil {
		return miscErr(err)
	}
	switch state {
	case chat1.MessageUnboxedState_VALID:
		valid := rawMsg.Valid()
		if !rawMsg.IsValidFull() {
			showErr := true
			// If we have an expired ephemeral message, don't show an error
			// message.
			if valid.IsEphemeral() && valid.IsEphemeralExpired(time.Now()) {
				showErr = false
			}
			if showErr {
				return miscErr(fmt.Errorf("unexpected deleted %v message",
					strings.ToLower(rawMsg.GetMessageType().String())))
			}
		}
		var strOutboxID *string
		if valid.ClientHeader.OutboxID != nil {
			so := valid.ClientHeader.OutboxID.String()
			strOutboxID = &so
		}
		res = chat1.NewUIMessageWithValid(chat1.UIMessageValid{
			MessageID:             rawMsg.GetMessageID(),
			Ctime:                 valid.ServerHeader.Ctime,
			OutboxID:              strOutboxID,
			MessageBody:           valid.MessageBody,
			SenderUsername:        valid.SenderUsername,
			SenderDeviceName:      valid.SenderDeviceName,
			SenderDeviceType:      valid.SenderDeviceType,
			SenderDeviceRevokedAt: valid.SenderDeviceRevokedAt,
			Superseded:            valid.ServerHeader.SupersededBy != 0,
			AtMentions:            valid.AtMentionUsernames,
			ChannelMention:        valid.ChannelMention,
			ChannelNameMentions:   PresentChannelNameMentions(ctx, valid.ChannelNameMentions),
			AssetUrlInfo:          presentAttachmentAssetInfo(ctx, g, rawMsg, convID),
			IsEphemeral:           valid.IsEphemeral(),
			IsEphemeralExpired:    valid.IsEphemeralExpired(time.Now()),
			ExplodedBy:            valid.ExplodedBy(),
			Etime:                 valid.Etime(),
			Reactions:             valid.Reactions,
			HasPairwiseMacs:       valid.HasPairwiseMacs(),
			PaymentInfo:           presentPaymentInfo(ctx, g, rawMsg.GetMessageID(), convID, valid),
			RequestInfo:           presentRequestInfo(ctx, g, rawMsg.GetMessageID(), convID, valid),
			Unfurls:               PresentUnfurls(ctx, g, convID, valid.Unfurls),
		})
	case chat1.MessageUnboxedState_OUTBOX:
		var body, title, filename string
		var preview *chat1.MakePreviewRes
		typ := rawMsg.Outbox().Msg.ClientHeader.MessageType
		switch typ {
		case chat1.MessageType_TEXT:
			body = rawMsg.Outbox().Msg.MessageBody.Text().Body
		case chat1.MessageType_EDIT:
			body = rawMsg.Outbox().Msg.MessageBody.Edit().Body
		case chat1.MessageType_ATTACHMENT:
			preview = rawMsg.Outbox().Preview
			msgBody := rawMsg.Outbox().Msg.MessageBody
			btyp, err := msgBody.MessageType()
			if err == nil && btyp == chat1.MessageType_ATTACHMENT {
				title = msgBody.Attachment().Object.Title
				filename = msgBody.Attachment().Object.Filename
			}
		}
		res = chat1.NewUIMessageWithOutbox(chat1.UIMessageOutbox{
			State:       rawMsg.Outbox().State,
			OutboxID:    rawMsg.Outbox().OutboxID.String(),
			MessageType: typ,
			Body:        body,
			Ctime:       rawMsg.Outbox().Ctime,
			Ordinal:     computeOutboxOrdinal(rawMsg.Outbox()),
			Preview:     preview,
			Title:       title,
			Filename:    filename,
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

type ByMsgUnboxedMsgID []chat1.MessageUnboxed

func (c ByMsgUnboxedMsgID) Len() int      { return len(c) }
func (c ByMsgUnboxedMsgID) Swap(i, j int) { c[i], c[j] = c[j], c[i] }
func (c ByMsgUnboxedMsgID) Less(i, j int) bool {
	return c[i].GetMessageID() > c[j].GetMessageID()
}

type ByMsgID []chat1.MessageID

func (m ByMsgID) Len() int           { return len(m) }
func (m ByMsgID) Swap(i, j int)      { m[i], m[j] = m[j], m[i] }
func (m ByMsgID) Less(i, j int) bool { return m[i] > m[j] }

func GetTopicName(conv chat1.ConversationLocal) string {
	maxTopicMsg, err := conv.GetMaxMessage(chat1.MessageType_METADATA)
	if err != nil {
		return ""
	}
	if !maxTopicMsg.IsValidFull() {
		return ""
	}
	return maxTopicMsg.Valid().MessageBody.Metadata().ConversationTitle
}

func GetHeadline(conv chat1.ConversationLocal) string {
	maxTopicMsg, err := conv.GetMaxMessage(chat1.MessageType_HEADLINE)
	if err != nil {
		return ""
	}
	if !maxTopicMsg.IsValidFull() {
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

func UsernamePackageToParticipant(p libkb.UsernamePackage) chat1.ConversationLocalParticipant {
	var fullName *string
	if p.FullName != nil {
		s := string(p.FullName.FullName)
		fullName = &s
	}
	return chat1.ConversationLocalParticipant{
		Username: p.NormalizedUsername.String(),
		Fullname: fullName,
	}
}

type pagerMsg struct {
	msgID chat1.MessageID
}

func (p pagerMsg) GetMessageID() chat1.MessageID {
	return p.msgID
}

func XlateMessageIDControlToPagination(control *chat1.MessageIDControl) (res *chat1.Pagination) {
	if control == nil {
		return res
	}
	pag := pager.NewThreadPager()
	res = new(chat1.Pagination)
	res.Num = control.Num
	if control.Pivot != nil {
		pm := pagerMsg{msgID: *control.Pivot}
		var err error
		if control.Recent {
			res.Previous, err = pag.MakeIndex(pm)
		} else {
			res.Next, err = pag.MakeIndex(pm)
		}
		if err != nil {
			return nil
		}
	}
	return res
}

// assetsForMessage gathers all assets on a message
func AssetsForMessage(g *globals.Context, msgBody chat1.MessageBody) (assets []chat1.Asset) {
	typ, err := msgBody.MessageType()
	if err != nil {
		// Log and drop the error for a malformed MessageBody.
		g.Log.Warning("error getting assets for message: %s", err)
		return assets
	}
	switch typ {
	case chat1.MessageType_ATTACHMENT:
		body := msgBody.Attachment()
		if body.Object.Path != "" {
			assets = append(assets, body.Object)
		}
		if body.Preview != nil {
			assets = append(assets, *body.Preview)
		}
		assets = append(assets, body.Previews...)
	case chat1.MessageType_ATTACHMENTUPLOADED:
		body := msgBody.Attachmentuploaded()
		if body.Object.Path != "" {
			assets = append(assets, body.Object)
		}
		assets = append(assets, body.Previews...)
	}
	return assets
}

func AddUserToTLFName(g *globals.Context, tlfName string, vis keybase1.TLFVisibility,
	membersType chat1.ConversationMembersType) string {
	switch membersType {
	case chat1.ConversationMembersType_IMPTEAMNATIVE, chat1.ConversationMembersType_IMPTEAMUPGRADE,
		chat1.ConversationMembersType_KBFS:
		username := g.Env.GetUsername().String()
		if vis != keybase1.TLFVisibility_PUBLIC {
			if len(tlfName) == 0 {
				tlfName = username
			} else {
				tlfName += "," + username
			}
		}
	}
	return tlfName
}

func ForceReloadUPAKsForUIDs(ctx context.Context, g *globals.Context, uids []keybase1.UID) error {
	getArg := func(i int) *libkb.LoadUserArg {
		if i >= len(uids) {
			return nil
		}
		tmp := libkb.NewLoadUserByUIDForceArg(g.GlobalContext, uids[i])
		return &tmp
	}
	return g.GetUPAKLoader().Batcher(ctx, getArg, nil, 0)
}

func CreateHiddenPlaceholder(msgID chat1.MessageID) chat1.MessageUnboxed {
	return chat1.NewMessageUnboxedWithPlaceholder(
		chat1.MessageUnboxedPlaceholder{
			MessageID: msgID,
			Hidden:    true,
		})
}

func GetGregorConn(ctx context.Context, g *globals.Context, log DebugLabeler,
	handler func(nist *libkb.NIST) rpc.ConnectionHandler) (conn *rpc.Connection, token gregor1.SessionToken, err error) {
	// Get session token
	nist, _, err := g.ActiveDevice.NISTAndUID(ctx)
	if nist == nil {
		log.Debug(ctx, "GetGregorConn: got a nil NIST, is the user logged out?")
		return conn, token, libkb.LoggedInError{}
	}
	if err != nil {
		log.Debug(ctx, "GetGregorConn: failed to get logged in session: %s", err.Error())
		return conn, token, err
	}
	token = gregor1.SessionToken(nist.Token().String())

	// Make an ad hoc connection to gregor
	uri, err := rpc.ParseFMPURI(g.Env.GetGregorURI())
	if err != nil {
		log.Debug(ctx, "GetGregorConn: failed to parse chat server UR: %s", err.Error())
		return conn, token, err
	}

	if uri.UseTLS() {
		rawCA := g.Env.GetBundledCA(uri.Host)
		if len(rawCA) == 0 {
			log.Debug(ctx, "GetGregorConn: failed to parse CAs: %s", err.Error())
			return conn, token, err
		}
		conn = rpc.NewTLSConnection(rpc.NewFixedRemote(uri.HostPort),
			[]byte(rawCA), libkb.NewContextifiedErrorUnwrapper(g.ExternalG()),
			handler(nist), libkb.NewRPCLogFactory(g.ExternalG()),
			logger.LogOutputWithDepthAdder{Logger: g.Log},
			rpc.DefaultMaxFrameLength, rpc.ConnectionOpts{})
	} else {
		t := rpc.NewConnectionTransport(uri, nil, libkb.MakeWrapError(g.ExternalG()), rpc.DefaultMaxFrameLength)
		conn = rpc.NewConnectionWithTransport(handler(nist), t,
			libkb.NewContextifiedErrorUnwrapper(g.ExternalG()),
			logger.LogOutputWithDepthAdder{Logger: g.Log}, rpc.ConnectionOpts{})
	}
	return conn, token, nil
}

// GetQueryRe returns a regex to match the query string on message text. This
// is used for result highlighting.
func GetQueryRe(query string) (*regexp.Regexp, error) {
	return regexp.Compile("(?i)" + regexp.QuoteMeta(query))
}

func SetUnfurl(mvalid *chat1.MessageUnboxedValid, unfurlMessageID chat1.MessageID,
	unfurl chat1.UnfurlResult) {
	if mvalid.Unfurls == nil {
		mvalid.Unfurls = make(map[chat1.MessageID]chat1.UnfurlResult)
	}
	mvalid.Unfurls[unfurlMessageID] = unfurl
}

// SuspendComponent will suspend the global ConvLoader until the return
// function is called. This allows a succinct call like defer
// SuspendComponent(ctx, g, g.ConvLoader)() in RPC handlers wishing to lock out
// the conv loader.
func SuspendComponent(ctx context.Context, g *globals.Context, suspendable types.Suspendable) func() {
	if canceled := suspendable.Suspend(ctx); canceled {
		g.Log.CDebugf(ctx, "SuspendComponent: canceled background task")
	}
	return func() {
		suspendable.Resume(ctx)
	}
}
