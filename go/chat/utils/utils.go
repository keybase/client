package utils

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/keybase/xurls"

	"github.com/keybase/client/go/chat/pager"
	"github.com/keybase/client/go/chat/unfurl/display"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/kyokomi/emoji"

	"regexp"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	context "golang.org/x/net/context"
	"golang.org/x/net/idna"
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

func ReorderParticipantsKBFS(mctx libkb.MetaContext, g libkb.UIDMapperContext, umapper libkb.UIDMapper,
	tlfName string, activeList []gregor1.UID) (writerNames []chat1.ConversationLocalParticipant, err error) {
	srcWriterNames, _, _, err := splitAndNormalizeTLFNameCanonicalize(mctx, tlfName, false)
	if err != nil {
		return writerNames, err
	}
	return ReorderParticipants(mctx, g, umapper, tlfName, srcWriterNames, activeList)
}

// ReorderParticipants based on the order in activeList.
// Only allows usernames from tlfname in the output.
// This never fails, worse comes to worst it just returns the split of tlfname.
func ReorderParticipants(mctx libkb.MetaContext, g libkb.UIDMapperContext, umapper libkb.UIDMapper,
	tlfName string, verifiedMembers []string, activeList []gregor1.UID) (writerNames []chat1.ConversationLocalParticipant, err error) {
	srcWriterNames, _, _, err := splitAndNormalizeTLFNameCanonicalize(mctx, tlfName, false)
	if err != nil {
		return writerNames, err
	}
	var activeKuids []keybase1.UID
	for _, a := range activeList {
		activeKuids = append(activeKuids, keybase1.UID(a.String()))
	}
	allowedWriters := make(map[string]bool)
	convNameUsers := make(map[string]bool)
	for _, user := range verifiedMembers {
		allowedWriters[user] = true
	}
	for _, user := range srcWriterNames {
		convNameUsers[user] = true
		allowedWriters[user] = true
	}

	packages, err := umapper.MapUIDsToUsernamePackages(mctx.Ctx(), g, activeKuids, time.Hour*24,
		10*time.Second, true)
	activeMap := make(map[string]chat1.ConversationLocalParticipant)
	if err == nil {
		for i := 0; i < len(activeKuids); i++ {
			part := UsernamePackageToParticipant(packages[i])
			part.InConvName = convNameUsers[part.Username]
			activeMap[activeKuids[i].String()] = part
		}
	}

	// Fill from the active list first.
	for _, uid := range activeList {
		kbUID := keybase1.UID(uid.String())
		p, ok := activeMap[kbUID.String()]
		if !ok {
			continue
		}
		if allowed := allowedWriters[p.Username]; allowed {
			writerNames = append(writerNames, p)
			// Allow only one occurrence.
			allowedWriters[p.Username] = false
		}
	}

	// Include participants even if they weren't in the active list, in stable order.
	var leftOvers []chat1.ConversationLocalParticipant
	for user, available := range allowedWriters {
		if !available {
			continue
		}
		part := UsernamePackageToParticipant(libkb.UsernamePackage{
			NormalizedUsername: libkb.NewNormalizedUsername(user),
			FullName:           nil,
		})
		part.InConvName = convNameUsers[part.Username]
		leftOvers = append(leftOvers, part)
		allowedWriters[user] = false
	}
	sort.Slice(leftOvers, func(i, j int) bool {
		return strings.Compare(leftOvers[i].Username, leftOvers[j].Username) < 0
	})
	writerNames = append(writerNames, leftOvers...)

	return writerNames, nil
}

// Drive splitAndNormalizeTLFName with one attempt to follow TlfNameNotCanonical.
func splitAndNormalizeTLFNameCanonicalize(mctx libkb.MetaContext, name string, public bool) (writerNames, readerNames []string, extensionSuffix string, err error) {
	writerNames, readerNames, extensionSuffix, err = SplitAndNormalizeTLFName(mctx, name, public)
	if retryErr, retry := err.(TlfNameNotCanonical); retry {
		return SplitAndNormalizeTLFName(mctx, retryErr.NameToTry, public)
	}
	return writerNames, readerNames, extensionSuffix, err
}

// AttachContactNames retrieves display names for SBS phones/emails that are in
// the phonebook. ConversationLocalParticipant structures are modified in place
// in `participants` passed in argument.
func AttachContactNames(mctx libkb.MetaContext, participants []chat1.ConversationLocalParticipant) {
	syncedContacts := mctx.G().SyncedContactList
	if syncedContacts == nil {
		mctx.Debug("AttachContactNames: SyncedContactList is nil")
		return
	}
	var assertionToContactName map[string]string
	var err error
	contactsFetched := false
	for i, participant := range participants {
		if isPhoneOrEmail(participant.Username) {
			if !contactsFetched {
				assertionToContactName, err = syncedContacts.RetrieveAssertionToName(mctx)
				if err != nil {
					mctx.Debug("AttachContactNames: error fetching contacts: %s", err)
					return
				}
				contactsFetched = true
			}
			if contactName, ok := assertionToContactName[participant.Username]; ok {
				participant.ContactName = &contactName
			} else {
				participant.ContactName = nil
			}
			participants[i] = participant
		}
	}
}

func isPhoneOrEmail(username string) bool {
	return strings.HasSuffix(username, "@phone") || strings.HasSuffix(username, "@email")
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
			ShowBadges:            false,
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

func checkMessageTypeQual(messageType chat1.MessageType, l []chat1.MessageType) bool {
	for _, mt := range l {
		if messageType == mt {
			return true
		}
	}
	return false
}

func IsVisibleChatMessageType(messageType chat1.MessageType) bool {
	return checkMessageTypeQual(messageType, chat1.VisibleChatMessageTypes())
}

func IsEditableByEditMessageType(messageType chat1.MessageType) bool {
	return checkMessageTypeQual(messageType, chat1.EditableMessageTypesByEdit())
}

func IsDeleteableByDeleteMessageType(messageType chat1.MessageType) bool {
	return checkMessageTypeQual(messageType, chat1.DeletableMessageTypesByDelete())
}

func IsCollapsibleMessageType(messageType chat1.MessageType) bool {
	switch messageType {
	case chat1.MessageType_UNFURL, chat1.MessageType_ATTACHMENT:
		return true
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

// Start at the beginng of the line, space, or some hand picked artisanal
// characters
const ServiceDecorationPrefix = `(?:^|[\s([/{:;.,!?"'])`

var chanNameMentionRegExp = regexp.MustCompile(ServiceDecorationPrefix + `(#(?:[0-9a-zA-Z_-]+))`)

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
		if cr, ok := validChans[name.name]; ok {
			res = append(res, cr)
		}
	}
	return res
}

var atMentionRegExp = regexp.MustCompile(ServiceDecorationPrefix +
	`(@(?:[a-zA-Z0-9][a-zA-Z0-9._]*[a-zA-Z0-9_]+(?:#[a-z0-9A-Z_-]+)?))`)

type nameMatch struct {
	name, normalizedName string
	position             []int
}

func (m nameMatch) Len() int {
	return m.position[1] - m.position[0]
}

func parseRegexpNames(ctx context.Context, body string, re *regexp.Regexp) (res []nameMatch) {
	body = ReplaceQuotedSubstrings(body, true)
	allIndexMatches := re.FindAllStringSubmatchIndex(body, -1)
	for _, indexMatch := range allIndexMatches {
		if len(indexMatch) >= 4 {
			// do +1 so we don't include the @ in the hit.
			low := indexMatch[2] + 1
			high := indexMatch[3]
			hit := body[low:high]
			res = append(res, nameMatch{
				name:           hit,
				normalizedName: strings.ToLower(hit),
				position:       []int{low, high},
			})
		}
	}
	return res
}

func GetTextAtMentionedItems(ctx context.Context, g *globals.Context, uid gregor1.UID,
	convID chat1.ConversationID, msg chat1.MessageText,
	getConvMembs func() ([]chat1.ConversationLocalParticipant, error),
	debug *DebugLabeler) (atRes []chat1.KnownUserMention, maybeRes []chat1.MaybeMention, chanRes chat1.ChannelMention) {
	atRes, maybeRes, chanRes = ParseAtMentionedItems(ctx, g, msg.Body, msg.UserMentions, getConvMembs)
	atRes = append(atRes, GetPaymentAtMentions(ctx, g.GetUPAKLoader(), msg.Payments, debug)...)
	if msg.ReplyToUID != nil {
		atRes = append(atRes, chat1.KnownUserMention{
			Text: "",
			Uid:  *msg.ReplyToUID,
		})
	}
	return atRes, maybeRes, chanRes
}

func GetPaymentAtMentions(ctx context.Context, upak libkb.UPAKLoader, payments []chat1.TextPayment,
	l *DebugLabeler) (atMentions []chat1.KnownUserMention) {
	for _, p := range payments {
		uid, err := upak.LookupUID(ctx, libkb.NewNormalizedUsername(p.Username))
		if err != nil {
			l.Debug(ctx, "GetPaymentAtMentions: error loading uid: username: %s err: %s", p.Username, err)
			continue
		}
		atMentions = append(atMentions, chat1.KnownUserMention{
			Uid:  uid.ToBytes(),
			Text: "",
		})
	}
	return atMentions
}

func parseItemAsUID(ctx context.Context, g *globals.Context, name string,
	knownMentions []chat1.KnownUserMention,
	getConvMembs func() ([]chat1.ConversationLocalParticipant, error)) (gregor1.UID, error) {
	nname := libkb.NewNormalizedUsername(name)
	shouldLookup := false
	for _, known := range knownMentions {
		if known.Text == nname.String() {
			shouldLookup = true
			break
		}
	}
	if !shouldLookup {
		shouldLookup = libkb.IsUserByUsernameOffline(libkb.NewMetaContext(ctx, g.ExternalG()), nname)
	}
	if !shouldLookup && getConvMembs != nil {
		membs, err := getConvMembs()
		if err != nil {
			return nil, err
		}
		for _, memb := range membs {
			if memb.Username == nname.String() {
				shouldLookup = true
				break
			}
		}
	}
	if shouldLookup {
		kuid, err := g.GetUPAKLoader().LookupUID(ctx, nname)
		if err != nil {
			return nil, err
		}
		return kuid.ToBytes(), nil
	}
	return nil, errors.New("not a username")
}

func ParseAtMentionedItems(ctx context.Context, g *globals.Context, body string,
	knownMentions []chat1.KnownUserMention, getConvMembs func() ([]chat1.ConversationLocalParticipant, error)) (atRes []chat1.KnownUserMention, maybeRes []chat1.MaybeMention, chanRes chat1.ChannelMention) {
	matches := parseRegexpNames(ctx, body, atMentionRegExp)
	chanRes = chat1.ChannelMention_NONE
	for _, m := range matches {
		var channel string
		toks := strings.Split(m.name, "#")
		baseName := toks[0]
		if len(toks) > 1 {
			channel = toks[1]
		}

		normalizedBaseName := strings.Split(m.normalizedName, "#")[0]
		switch normalizedBaseName {
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

		// Try UID first then team
		if uid, err := parseItemAsUID(ctx, g, normalizedBaseName, knownMentions, getConvMembs); err == nil {
			atRes = append(atRes, chat1.KnownUserMention{
				Text: baseName,
				Uid:  uid,
			})
		} else {
			// anything else is a possible mention
			maybeRes = append(maybeRes, chat1.MaybeMention{
				Name:    baseName,
				Channel: channel,
			})
		}
	}
	return atRes, maybeRes, chanRes
}

type SystemMessageUIDSource interface {
	LookupUID(ctx context.Context, un libkb.NormalizedUsername) (keybase1.UID, error)
}

func SystemMessageMentions(ctx context.Context, body chat1.MessageSystem, upak SystemMessageUIDSource) (atMentions []gregor1.UID, chanMention chat1.ChannelMention) {
	typ, err := body.SystemType()
	if err != nil {
		return nil, 0
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
	case chat1.MessageSystemType_BULKADDTOCONV:
		for _, username := range body.Bulkaddtoconv().Usernames {
			uid, err := upak.LookupUID(ctx, libkb.NewNormalizedUsername(username))
			if err == nil {
				atMentions = append(atMentions, uid.ToBytes())
			}
		}
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

func GetConvMtime(rc types.RemoteConversation) (res gregor1.Time) {
	conv := rc.Conv
	var summaries []chat1.MessageSummary
	for _, typ := range chat1.VisibleChatMessageTypes() {
		summary, err := conv.GetMaxMessage(typ)
		if err == nil {
			summaries = append(summaries, summary)
		}
	}
	sort.Sort(ByMsgSummaryCtime(summaries))
	if len(summaries) == 0 {
		res = conv.ReaderInfo.Mtime
	} else {
		res = summaries[len(summaries)-1].Ctime
	}
	if res > rc.LocalMtime {
		return res
	}
	return rc.LocalMtime
}

// GetConvPriorityScore weighs conversations that are fully read above ones
// that are not, weighting more recently modified conversations higher.. Used
// to order conversations when background loading.
func GetConvPriorityScore(rc types.RemoteConversation) float64 {
	readMsgID := rc.GetReadMsgID()
	maxMsgID := rc.Conv.ReaderInfo.MaxMsgid
	mtime := GetConvMtime(rc)
	dur := math.Abs(float64(time.Since(mtime.Time())) / float64(time.Hour))
	return 100 / math.Pow(dur+float64(maxMsgID-readMsgID), 0.5)
}

type MessageSummaryContainer interface {
	GetMaxMessage(typ chat1.MessageType) (chat1.MessageSummary, error)
}

func PickLatestMessageSummary(conv MessageSummaryContainer, typs []chat1.MessageType) (res chat1.MessageSummary, err error) {
	// nil means all
	if typs == nil {
		for typ := range chat1.MessageTypeRevMap {
			typs = append(typs, typ)
		}
	}
	for _, typ := range typs {
		msg, err := conv.GetMaxMessage(typ)
		if err == nil && (msg.Ctime.After(res.Ctime) || res.Ctime.IsZero()) {
			res = msg
		}
	}
	if res.GetMessageID() == 0 {
		return res, errors.New("no message summary found")
	}
	return res, nil
}

func GetConvMtimeLocal(conv chat1.ConversationLocal) gregor1.Time {
	msg, err := PickLatestMessageSummary(conv, chat1.VisibleChatMessageTypes())
	if err != nil {
		return conv.ReaderInfo.Mtime
	}
	return msg.Ctime
}

func GetRemoteConvTLFName(conv types.RemoteConversation) string {
	if conv.LocalMetadata != nil {
		return conv.LocalMetadata.Name
	}
	msg, err := PickLatestMessageSummary(conv.Conv, nil)
	if err != nil {
		return ""
	}
	return msg.TlfName
}

func GetRemoteConvDisplayName(rc types.RemoteConversation) string {
	tlfName := GetRemoteConvTLFName(rc)
	switch rc.Conv.Metadata.TeamType {
	case chat1.TeamType_COMPLEX:
		if rc.LocalMetadata != nil && len(rc.Conv.MaxMsgSummaries) > 0 {
			return fmt.Sprintf("%s#%s", tlfName, rc.LocalMetadata.TopicName)
		}
		fallthrough
	default:
		return tlfName
	}
}

func GetConvSnippet(conv chat1.ConversationLocal, currentUsername string) (chat1.SnippetDecoration, string) {

	if conv.Info.SnippetMsg == nil {
		return chat1.SnippetDecoration_NONE, ""
	}
	msg := *conv.Info.SnippetMsg

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

func showSenderPrefix(conv chat1.ConversationLocal) (showPrefix bool) {
	switch conv.GetMembersType() {
	case chat1.ConversationMembersType_TEAM:
		showPrefix = true
	default:
		showPrefix = len(conv.AllNames()) > 2
	}
	return showPrefix
}

// Sender prefix for msg snippets. Will show if a conversation has > 2 members
// or is of type TEAM
func getSenderPrefix(conv chat1.ConversationLocal, currentUsername, senderUsername string) (senderPrefix string) {
	if showSenderPrefix(conv) {
		if senderUsername == currentUsername {
			senderPrefix = "You: "
		} else {
			senderPrefix = fmt.Sprintf("%s: ", senderUsername)
		}
	}
	return senderPrefix
}

func formatDuration(dur time.Duration) string {
	h := dur / time.Hour
	dur -= h * time.Hour
	m := dur / time.Minute
	dur -= m * time.Minute
	s := dur / time.Second
	if h > 0 {
		return fmt.Sprintf("%02d:%02d:%02d", h, m, s)
	}
	return fmt.Sprintf("%02d:%02d", m, s)
}

func getMsgSnippetDecoration(msg chat1.MessageUnboxed) chat1.SnippetDecoration {
	var msgBody chat1.MessageBody
	if msg.IsValid() {
		msgBody = msg.Valid().MessageBody
	} else {
		msgBody = msg.Outbox().Msg.MessageBody
	}
	switch msg.GetMessageType() {
	case chat1.MessageType_ATTACHMENT:
		obj := msgBody.Attachment().Object
		atyp, err := obj.Metadata.AssetType()
		if err != nil {
			return chat1.SnippetDecoration_NONE
		}
		switch atyp {
		case chat1.AssetMetadataType_IMAGE:
			return chat1.SnippetDecoration_PHOTO_ATTACHMENT
		case chat1.AssetMetadataType_VIDEO:
			if obj.Metadata.Video().IsAudio {
				return chat1.SnippetDecoration_AUDIO_ATTACHMENT
			}
			return chat1.SnippetDecoration_VIDEO_ATTACHMENT
		}
		return chat1.SnippetDecoration_FILE_ATTACHMENT
	case chat1.MessageType_REQUESTPAYMENT:
		return chat1.SnippetDecoration_STELLAR_RECEIVED
	case chat1.MessageType_SENDPAYMENT:
		return chat1.SnippetDecoration_STELLAR_SENT
	case chat1.MessageType_PIN:
		return chat1.SnippetDecoration_PINNED_MESSAGE
	}
	return chat1.SnippetDecoration_NONE
}

func GetMsgSnippetBody(msg chat1.MessageUnboxed) (snippet string) {
	defer func() {
		snippet = EscapeShrugs(context.TODO(), snippet)
	}()
	if !(msg.IsValidFull() || msg.IsOutbox()) {
		return ""
	}
	var msgBody chat1.MessageBody
	if msg.IsValid() {
		msgBody = msg.Valid().MessageBody
	} else {
		msgBody = msg.Outbox().Msg.MessageBody
	}
	switch msg.GetMessageType() {
	case chat1.MessageType_TEXT:
		return msgBody.Text().Body
	case chat1.MessageType_EDIT:
		return msgBody.Edit().Body
	case chat1.MessageType_FLIP:
		return msgBody.Flip().Text
	case chat1.MessageType_PIN:
		return "Pinned message"
	case chat1.MessageType_ATTACHMENT:
		obj := msgBody.Attachment().Object
		title := obj.Title
		if len(title) == 0 {
			atyp, err := obj.Metadata.AssetType()
			if err != nil {
				return "???"
			}
			switch atyp {
			case chat1.AssetMetadataType_IMAGE:
				title = "Image attachment"
			case chat1.AssetMetadataType_VIDEO:
				dur := formatDuration(time.Duration(obj.Metadata.Video().DurationMs) * time.Millisecond)
				if obj.Metadata.Video().IsAudio {
					title = fmt.Sprintf("Audio message (%s)", dur)
				} else {
					title = fmt.Sprintf("Video attachment (%s)", dur)
				}
			default:
				if obj.Filename == "" {
					title = "File attachment"
				} else {
					title = obj.Filename
				}
			}
		}
		return title
	case chat1.MessageType_SYSTEM:
		return msgBody.System().String()
	case chat1.MessageType_REQUESTPAYMENT:
		return "Payment requested"
	case chat1.MessageType_SENDPAYMENT:
		return "Payment sent"
	case chat1.MessageType_HEADLINE:
		return msgBody.Headline().String()
	}
	return ""
}

func GetMsgSnippet(msg chat1.MessageUnboxed, conv chat1.ConversationLocal, currentUsername string) (decoration chat1.SnippetDecoration, snippet string) {
	if !(msg.IsValid() || msg.IsOutbox()) {
		return chat1.SnippetDecoration_NONE, ""
	}

	var senderUsername string
	if msg.IsValid() {
		senderUsername = msg.Valid().SenderUsername
	} else {
		senderUsername = currentUsername
	}

	senderPrefix := getSenderPrefix(conv, currentUsername, senderUsername)
	// does not apply to outbox messages, ephemeral timer starts once the server
	// assigns a ctime.
	if msg.IsValid() && !msg.IsValidFull() {
		if msg.Valid().IsEphemeral() && msg.Valid().IsEphemeralExpired(time.Now()) {
			return chat1.SnippetDecoration_EXPLODED_MESSAGE, fmt.Sprintf("%s ----------------------------", senderPrefix)
		}
		return chat1.SnippetDecoration_NONE, ""
	}

	if msg.IsOutbox() {
		decoration = chat1.SnippetDecoration_PENDING_MESSAGE
		if msg.Outbox().IsError() {
			decoration = chat1.SnippetDecoration_FAILED_PENDING_MESSAGE
		}
	} else if msg.Valid().IsEphemeral() {
		decoration = chat1.SnippetDecoration_EXPLODING_MESSAGE
	} else {
		decoration = getMsgSnippetDecoration(msg)
	}
	snippet = GetMsgSnippetBody(msg)
	if snippet == "" {
		decoration = chat1.SnippetDecoration_NONE
	}
	return decoration, senderPrefix + snippet
}

// We don't want to display the contents of an exploding message in notifications
func GetDesktopNotificationSnippet(conv *chat1.ConversationLocal, currentUsername string,
	fromMsg *chat1.MessageUnboxed, plaintextDesktopDisabled bool) string {
	if conv == nil {
		return ""
	}
	var msg chat1.MessageUnboxed
	if fromMsg != nil {
		msg = *fromMsg
	} else if conv.Info.SnippetMsg != nil {
		msg = *conv.Info.SnippetMsg
	} else {
		return ""
	}
	if !msg.IsValid() {
		return ""
	}

	mvalid := msg.Valid()
	if mvalid.IsEphemeral() {
		// If the message is already exploded, nothing to see here.
		if !msg.IsValidFull() {
			return ""
		}
		switch msg.GetMessageType() {
		case chat1.MessageType_TEXT, chat1.MessageType_ATTACHMENT, chat1.MessageType_EDIT:
			return "💣 exploding message."
		default:
			return ""
		}
	} else if plaintextDesktopDisabled {
		return "New message"
	}

	switch msg.GetMessageType() {
	case chat1.MessageType_REACTION:
		reaction, err := GetReaction(msg)
		if err != nil {
			return ""
		}
		var prefix string
		if showSenderPrefix(*conv) {
			prefix = mvalid.SenderUsername + " "
		}
		return emoji.Sprintf("%sreacted to your message with %v", prefix, reaction)
	default:
		decoration, snippetBody := GetMsgSnippet(msg, *conv, currentUsername)
		return fmt.Sprintf("%s %s", decoration.ToEmoji(), snippetBody)
	}
}

func StripUsernameFromConvName(name string, username string) (res string) {
	res = strings.Replace(name, fmt.Sprintf(",%s", username), "", -1)
	res = strings.Replace(res, fmt.Sprintf("%s,", username), "", -1)
	return res
}

func PresentRemoteConversationAsSmallTeamRow(ctx context.Context, rc types.RemoteConversation,
	username string, useSnippet bool) (res chat1.UIInboxSmallTeamRow) {
	res.ConvID = rc.ConvIDStr
	res.IsTeam = rc.GetTeamType() != chat1.TeamType_NONE
	res.Name = StripUsernameFromConvName(GetRemoteConvDisplayName(rc), username)
	res.Time = GetConvMtime(rc)
	if useSnippet && rc.LocalMetadata != nil {
		res.SnippetDecoration = rc.LocalMetadata.SnippetDecoration
		res.Snippet = &rc.LocalMetadata.Snippet
	}
	res.Draft = rc.LocalDraft
	res.IsMuted = rc.Conv.Metadata.Status == chat1.ConversationStatus_MUTED
	return res
}

func PresentRemoteConversationAsBigTeamChannelRow(ctx context.Context, rc types.RemoteConversation) (res chat1.UIInboxBigTeamChannelRow) {
	res.ConvID = rc.ConvIDStr
	res.Channelname = rc.GetTopicName()
	res.Teamname = GetRemoteConvTLFName(rc)
	res.Draft = rc.LocalDraft
	res.IsMuted = rc.Conv.Metadata.Status == chat1.ConversationStatus_MUTED
	return res
}

func PresentRemoteConversation(ctx context.Context, g *globals.Context, rc types.RemoteConversation) (res chat1.UnverifiedInboxUIItem) {
	var tlfName string
	rawConv := rc.Conv
	latest, err := PickLatestMessageSummary(rawConv, nil)
	if err != nil {
		tlfName = ""
	} else {
		tlfName = latest.TlfName
	}
	res.ConvID = rc.ConvIDStr
	res.TlfID = rawConv.Metadata.IdTriple.Tlfid.String()
	res.TopicType = rawConv.GetTopicType()
	res.IsPublic = rawConv.Metadata.Visibility == keybase1.TLFVisibility_PUBLIC
	res.Name = tlfName
	res.Status = rawConv.Metadata.Status
	res.Time = GetConvMtime(rc)
	res.Visibility = rawConv.Metadata.Visibility
	res.Notifications = rawConv.Notifications
	res.MembersType = rawConv.GetMembersType()
	res.MemberStatus = rawConv.ReaderInfo.Status
	res.TeamType = rawConv.Metadata.TeamType
	res.Version = rawConv.Metadata.Version
	res.LocalVersion = rawConv.Metadata.LocalVersion
	res.MaxMsgID = rawConv.ReaderInfo.MaxMsgid
	res.MaxVisibleMsgID = rawConv.MaxVisibleMsgID()
	res.ReadMsgID = rawConv.ReaderInfo.ReadMsgid
	res.Supersedes = rawConv.Metadata.Supersedes
	res.SupersededBy = rawConv.Metadata.SupersededBy
	res.FinalizeInfo = rawConv.Metadata.FinalizeInfo
	res.Commands =
		chat1.NewConversationCommandGroupsWithBuiltin(g.CommandsSource.GetBuiltinCommandType(ctx, rc))
	if rc.LocalMetadata != nil {
		res.LocalMetadata = &chat1.UnverifiedInboxUIItemMetadata{
			ChannelName:       rc.LocalMetadata.TopicName,
			Headline:          rc.LocalMetadata.Headline,
			HeadlineDecorated: DecorateWithLinks(ctx, EscapeForDecorate(ctx, rc.LocalMetadata.Headline)),
			Snippet:           rc.LocalMetadata.Snippet,
			SnippetDecoration: rc.LocalMetadata.SnippetDecoration,
			WriterNames:       rc.LocalMetadata.WriterNames,
			ResetParticipants: rc.LocalMetadata.ResetParticipants,
		}
		res.Name = rc.LocalMetadata.Name
	}
	res.ConvRetention = rawConv.ConvRetention
	res.TeamRetention = rawConv.TeamRetention
	res.Draft = rc.LocalDraft
	return res
}

func PresentRemoteConversations(ctx context.Context, g *globals.Context, rcs []types.RemoteConversation) (res []chat1.UnverifiedInboxUIItem) {
	for _, rc := range rcs {
		res = append(res, PresentRemoteConversation(ctx, g, rc))
	}
	return res
}

func SearchableRemoteConversationName(conv types.RemoteConversation, username string) string {
	name := GetRemoteConvDisplayName(conv)
	// Check for self conv or big team conv
	if name == username || strings.Contains(name, "#") {
		return name
	}
	name = strings.Replace(name, fmt.Sprintf(",%s", username), "", -1)
	name = strings.Replace(name, fmt.Sprintf("%s,", username), "", -1)
	return name
}

func PresentRemoteConversationAsSearchHit(conv types.RemoteConversation, username string) chat1.UIChatSearchConvHit {
	return chat1.UIChatSearchConvHit{
		ConvID:   conv.ConvIDStr,
		TeamType: conv.GetTeamType(),
		Name:     SearchableRemoteConversationName(conv, username),
		Mtime:    conv.GetMtime(),
	}
}

func PresentRemoteConversationsAsSearchHits(convs []types.RemoteConversation, username string) (res []chat1.UIChatSearchConvHit) {
	for _, c := range convs {
		res = append(res, PresentRemoteConversationAsSearchHit(c, username))
	}
	return res
}

func PresentConversationErrorLocal(ctx context.Context, g *globals.Context, rawConv chat1.ConversationErrorLocal) (res chat1.InboxUIItemError) {
	res.Message = rawConv.Message
	res.RekeyInfo = rawConv.RekeyInfo
	res.RemoteConv = PresentRemoteConversation(ctx, g, types.RemoteConversation{
		Conv:      rawConv.RemoteConv,
		ConvIDStr: rawConv.RemoteConv.GetConvID().String(),
	})
	res.Typ = rawConv.Typ
	res.UnverifiedTLFName = rawConv.UnverifiedTLFName
	return res
}

func getParticipantType(username string) chat1.UIParticipantType {
	if strings.HasSuffix(username, "@phone") {
		return chat1.UIParticipantType_PHONENO
	}
	if strings.HasSuffix(username, "@email") {
		return chat1.UIParticipantType_EMAIL
	}
	return chat1.UIParticipantType_USER
}

func presentConversationParticipantsLocal(ctx context.Context, rawParticipants []chat1.ConversationLocalParticipant) (participants []chat1.UIParticipant) {
	for _, p := range rawParticipants {
		participantType := getParticipantType(p.Username)
		participants = append(participants, chat1.UIParticipant{
			Assertion:   p.Username,
			InConvName:  p.InConvName,
			ContactName: p.ContactName,
			FullName:    p.Fullname,
			Type:        participantType,
		})
	}
	return participants
}

type PresentParticipantsMode int

const (
	PresentParticipantsModeInclude PresentParticipantsMode = iota
	PresentParticipantsModeSkip
)

func PresentConversationLocal(ctx context.Context, g *globals.Context, uid gregor1.UID,
	rawConv chat1.ConversationLocal, partMode PresentParticipantsMode) (res chat1.InboxUIItem) {
	res.ConvID = rawConv.GetConvID().String()
	res.TlfID = rawConv.Info.Triple.Tlfid.String()
	res.TopicType = rawConv.GetTopicType()
	res.IsPublic = rawConv.Info.Visibility == keybase1.TLFVisibility_PUBLIC
	res.Name = rawConv.Info.TlfName
	res.SnippetDecoration, res.Snippet = GetConvSnippet(rawConv, g.GetEnv().GetUsername().String())
	res.Channel = rawConv.Info.TopicName
	res.Headline = rawConv.Info.Headline
	res.HeadlineDecorated = DecorateWithLinks(ctx, EscapeForDecorate(ctx, rawConv.Info.Headline))
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
	res.LocalVersion = rawConv.Info.LocalVersion
	res.MaxMsgID = rawConv.ReaderInfo.MaxMsgid
	res.MaxVisibleMsgID = rawConv.MaxVisibleMsgID()
	res.ReadMsgID = rawConv.ReaderInfo.ReadMsgid
	res.ConvRetention = rawConv.ConvRetention
	res.TeamRetention = rawConv.TeamRetention
	res.ConvSettings = rawConv.ConvSettings
	res.Commands = rawConv.Commands
	res.BotCommands = rawConv.BotCommands
	res.BotAliases = rawConv.BotAliases
	res.Draft = rawConv.Info.Draft
	if rawConv.Info.PinnedMsg != nil {
		res.PinnedMsg = new(chat1.UIPinnedMessage)
		res.PinnedMsg.Message = PresentMessageUnboxed(ctx, g, rawConv.Info.PinnedMsg.Message, uid,
			rawConv.GetConvID())
		res.PinnedMsg.PinnerUsername = rawConv.Info.PinnedMsg.PinnerUsername
	}
	switch partMode {
	case PresentParticipantsModeInclude:
		res.Participants = presentConversationParticipantsLocal(ctx, rawConv.Info.Participants)
	default:
	}
	return res
}

func PresentConversationLocals(ctx context.Context, g *globals.Context, uid gregor1.UID,
	convs []chat1.ConversationLocal, partMode PresentParticipantsMode) (res []chat1.InboxUIItem) {
	for _, conv := range convs {
		res = append(res, PresentConversationLocal(ctx, g, uid, conv, partMode))
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
	return computeOrdinal(obr.Msg.ClientHeader.OutboxInfo.Prev, obr.Ordinal)
}

// Compute an "ordinal". There are two senses of "ordinal".
// The service considers ordinals ints, like 3, which are the offset after some message ID.
// The frontend considers ordinals floats like "180.03" where before the dot is
// a message ID, and after the dot is a sub-position in thousandths.
// This function translates from the service's sense to the frontend's sense.
func computeOrdinal(messageID chat1.MessageID, serviceOrdinal int) (frontendOrdinal float64) {
	return float64(messageID) + float64(serviceOrdinal)/1000.0
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

func PresentBytes(bytes int64) string {
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
		value /= TERABYTE
	case bytes >= GIGABYTE:
		unit = "GB"
		value /= GIGABYTE
	case bytes >= MEGABYTE:
		unit = "MB"
		value /= MEGABYTE
	case bytes >= KILOBYTE:
		unit = "KB"
		value /= KILOBYTE
	case bytes >= BYTE:
		unit = "B"
	case bytes == 0:
		return "0"
	}
	return fmt.Sprintf("%.02f%s", value, unit)
}

func formatVideoSize(bytes int64) string {
	return PresentBytes(bytes)
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
	convID chat1.ConversationID, msg chat1.MessageUnboxedValid) []chat1.UIPaymentInfo {

	typ, err := msg.MessageBody.MessageType()
	if err != nil {
		return nil
	}

	var infos []chat1.UIPaymentInfo

	switch typ {
	case chat1.MessageType_SENDPAYMENT:
		body := msg.MessageBody.Sendpayment()
		info := g.StellarLoader.LoadPayment(ctx, convID, msgID, msg.SenderUsername, body.PaymentID)
		if info != nil {
			infos = []chat1.UIPaymentInfo{*info}
		}
	case chat1.MessageType_TEXT:
		body := msg.MessageBody.Text()
		// load any payments that were in the body of the text message
		for _, payment := range body.Payments {
			rtyp, err := payment.Result.ResultTyp()
			if err != nil {
				continue
			}
			switch rtyp {
			case chat1.TextPaymentResultTyp_SENT:
				paymentID := payment.Result.Sent()
				info := g.StellarLoader.LoadPayment(ctx, convID, msgID, msg.SenderUsername, paymentID)
				if info != nil {
					infos = append(infos, *info)
				}
			default:
				// Nothing to do for other payment result types.
			}
		}
	}

	return infos
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
	default:
		// Nothing to do for other message types.
	}
	return nil
}

func PresentUnfurl(ctx context.Context, g *globals.Context, convID chat1.ConversationID, u chat1.Unfurl) *chat1.UnfurlDisplay {
	ud, err := display.DisplayUnfurl(ctx, g.AttachmentURLSrv, convID, u)
	if err != nil {
		g.GetLog().CDebugf(ctx, "PresentUnfurl: failed to display unfurl: %s", err)
		return nil
	}
	return &ud
}

func PresentUnfurls(ctx context.Context, g *globals.Context, uid gregor1.UID,
	convID chat1.ConversationID, unfurls map[chat1.MessageID]chat1.UnfurlResult) (res []chat1.UIMessageUnfurlInfo) {
	collapses := NewCollapses(g)
	for unfurlMessageID, u := range unfurls {
		ud := PresentUnfurl(ctx, g, convID, u.Unfurl)
		if ud != nil {
			res = append(res, chat1.UIMessageUnfurlInfo{
				IsCollapsed: collapses.IsCollapsed(ctx, uid, convID, unfurlMessageID,
					chat1.MessageType_UNFURL),
				Unfurl:          *ud,
				UnfurlMessageID: unfurlMessageID,
				Url:             u.Url,
			})
		}
	}
	return res
}

func PresentDecoratedUserBio(ctx context.Context, bio string) (res string) {
	res = EscapeForDecorate(ctx, bio)
	res = EscapeShrugs(ctx, res)
	res = DecorateWithLinks(ctx, res)
	return res
}

func PresentDecoratedTextBody(ctx context.Context, g *globals.Context, msg chat1.MessageUnboxedValid) *string {
	msgBody := msg.MessageBody
	typ, err := msgBody.MessageType()
	if err != nil {
		return nil
	}
	var body string
	var payments []chat1.TextPayment
	switch typ {
	case chat1.MessageType_TEXT:
		body = msgBody.Text().Body
		payments = msgBody.Text().Payments
	case chat1.MessageType_FLIP:
		body = msgBody.Flip().Text
	default:
		return nil
	}

	// escape before applying xforms
	body = EscapeForDecorate(ctx, body)
	body = EscapeShrugs(ctx, body)

	// This needs to happen before (deep) links.
	kbfsPaths := ParseKBFSPaths(ctx, body)
	body = DecorateWithKBFSPath(ctx, body, kbfsPaths)

	// Links
	body = DecorateWithLinks(ctx, body)
	// Payment decorations
	body = g.StellarSender.DecorateWithPayments(ctx, body, payments)
	// Mentions
	body = DecorateWithMentions(ctx, body, msg.AtMentionUsernames, msg.MaybeMentions, msg.ChannelMention,
		msg.ChannelNameMentions)
	return &body
}

func loadTeamMentions(ctx context.Context, g *globals.Context, uid gregor1.UID,
	valid chat1.MessageUnboxedValid) {
	var knownTeamMentions []chat1.KnownTeamMention
	typ, err := valid.MessageBody.MessageType()
	if err != nil {
		return
	}
	switch typ {
	case chat1.MessageType_TEXT:
		knownTeamMentions = valid.MessageBody.Text().TeamMentions
	case chat1.MessageType_FLIP:
		knownTeamMentions = valid.MessageBody.Flip().TeamMentions
	case chat1.MessageType_EDIT:
		knownTeamMentions = valid.MessageBody.Edit().TeamMentions
	}
	for _, tm := range valid.MaybeMentions {
		if err := g.TeamMentionLoader.LoadTeamMention(ctx, uid, tm, knownTeamMentions, false); err != nil {
			g.GetLog().CDebugf(ctx, "loadTeamMentions: error loading team mentions: %+v", err)
		}
	}
}

func presentFlipGameID(ctx context.Context, g *globals.Context, uid gregor1.UID,
	convID chat1.ConversationID, msg chat1.MessageUnboxed) *string {
	typ, err := msg.State()
	if err != nil {
		return nil
	}
	var body chat1.MessageBody
	switch typ {
	case chat1.MessageUnboxedState_VALID:
		body = msg.Valid().MessageBody
	case chat1.MessageUnboxedState_OUTBOX:
		body = msg.Outbox().Msg.MessageBody
	default:
		return nil
	}
	if !body.IsType(chat1.MessageType_FLIP) {
		return nil
	}
	if msg.GetTopicType() == chat1.TopicType_CHAT && !msg.IsOutbox() {
		// only queue up a flip load for the flip messages in chat channels
		g.CoinFlipManager.LoadFlip(ctx, uid, convID, msg.GetMessageID(), body.Flip().FlipConvID,
			body.Flip().GameID)
	}
	ret := body.Flip().GameID.String()
	return &ret
}

func PresentMessagesUnboxed(ctx context.Context, g *globals.Context, msgs []chat1.MessageUnboxed,
	uid gregor1.UID, convID chat1.ConversationID) (res []chat1.UIMessage) {
	for _, msg := range msgs {
		res = append(res, PresentMessageUnboxed(ctx, g, msg, uid, convID))
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

	collapses := NewCollapses(g)
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
		var replyTo *chat1.UIMessage
		if valid.ReplyTo != nil {
			replyTo = new(chat1.UIMessage)
			*replyTo = PresentMessageUnboxed(ctx, g, *valid.ReplyTo, uid, convID)
		}
		var pinnedMessageID *chat1.MessageID
		if valid.MessageBody.IsType(chat1.MessageType_PIN) {
			pinnedMessageID = new(chat1.MessageID)
			*pinnedMessageID = valid.MessageBody.Pin().MsgID
		}
		loadTeamMentions(ctx, g, uid, valid)
		res = chat1.NewUIMessageWithValid(chat1.UIMessageValid{
			MessageID:             rawMsg.GetMessageID(),
			Ctime:                 valid.ServerHeader.Ctime,
			OutboxID:              strOutboxID,
			MessageBody:           valid.MessageBody,
			DecoratedTextBody:     PresentDecoratedTextBody(ctx, g, valid),
			BodySummary:           GetMsgSnippetBody(rawMsg),
			SenderUsername:        valid.SenderUsername,
			SenderDeviceName:      valid.SenderDeviceName,
			SenderDeviceType:      valid.SenderDeviceType,
			SenderDeviceRevokedAt: valid.SenderDeviceRevokedAt,
			SenderUID:             valid.ClientHeader.Sender,
			SenderDeviceID:        valid.ClientHeader.SenderDevice,
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
			FlipGameID:            presentFlipGameID(ctx, g, uid, convID, rawMsg),
			PaymentInfos:          presentPaymentInfo(ctx, g, rawMsg.GetMessageID(), convID, valid),
			RequestInfo:           presentRequestInfo(ctx, g, rawMsg.GetMessageID(), convID, valid),
			Unfurls:               PresentUnfurls(ctx, g, uid, convID, valid.Unfurls),
			IsDeleteable:          IsDeleteableByDeleteMessageType(rawMsg.GetMessageType()),
			IsEditable:            IsEditableByEditMessageType(rawMsg.GetMessageType()),
			ReplyTo:               replyTo,
			PinnedMessageID:       pinnedMessageID,
			BotUsername:           valid.BotUsername,
			IsCollapsed: collapses.IsCollapsed(ctx, uid, convID, rawMsg.GetMessageID(),
				rawMsg.GetMessageType()),
		})
	case chat1.MessageUnboxedState_OUTBOX:
		var body, title, filename string
		var decoratedBody *string
		var preview *chat1.MakePreviewRes
		typ := rawMsg.Outbox().Msg.ClientHeader.MessageType
		switch typ {
		case chat1.MessageType_TEXT:
			body = rawMsg.Outbox().Msg.MessageBody.Text().Body
			decoratedBody = new(string)
			*decoratedBody = EscapeShrugs(ctx, body)
		case chat1.MessageType_FLIP:
			body = rawMsg.Outbox().Msg.MessageBody.Flip().Text
			decoratedBody = new(string)
			*decoratedBody = EscapeShrugs(ctx, body)
		case chat1.MessageType_EDIT:
			body = rawMsg.Outbox().Msg.MessageBody.Edit().Body
		case chat1.MessageType_ATTACHMENT:
			preview = rawMsg.Outbox().Preview
			msgBody := rawMsg.Outbox().Msg.MessageBody
			btyp, err := msgBody.MessageType()
			if err == nil && btyp == chat1.MessageType_ATTACHMENT {
				asset := msgBody.Attachment().Object
				title = asset.Title
				filename = asset.Filename
			}
		}
		var replyTo *chat1.UIMessage
		if rawMsg.Outbox().ReplyTo != nil {
			replyTo = new(chat1.UIMessage)
			*replyTo = PresentMessageUnboxed(ctx, g, *rawMsg.Outbox().ReplyTo, uid, convID)
		}
		res = chat1.NewUIMessageWithOutbox(chat1.UIMessageOutbox{
			State:             rawMsg.Outbox().State,
			OutboxID:          rawMsg.Outbox().OutboxID.String(),
			MessageType:       typ,
			Body:              body,
			DecoratedTextBody: decoratedBody,
			Ctime:             rawMsg.Outbox().Ctime,
			Ordinal:           computeOutboxOrdinal(rawMsg.Outbox()),
			Preview:           preview,
			Title:             title,
			Filename:          filename,
			IsEphemeral:       rawMsg.Outbox().Msg.IsEphemeral(),
			FlipGameID:        presentFlipGameID(ctx, g, uid, convID, rawMsg),
			ReplyTo:           replyTo,
		})
	case chat1.MessageUnboxedState_ERROR:
		res = chat1.NewUIMessageWithError(rawMsg.Error())
	case chat1.MessageUnboxedState_PLACEHOLDER:
		res = chat1.NewUIMessageWithPlaceholder(rawMsg.Placeholder())
	case chat1.MessageUnboxedState_JOURNEYCARD:
		journeycard := rawMsg.Journeycard()
		res = chat1.NewUIMessageWithJourneycard(chat1.UIMessageJourneycard{
			Ordinal:        computeOrdinal(journeycard.PrevID, journeycard.Ordinal),
			CardType:       journeycard.CardType,
			HighlightMsgID: journeycard.HighlightMsgID,
			OpenTeam:       journeycard.OpenTeam,
		})
	default:
		g.MetaContext(ctx).Debug("PresentMessageUnboxed: unhandled MessageUnboxedState: %v", state)
		// res = zero values
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

type RemoteConvByMtime []types.RemoteConversation

func (c RemoteConvByMtime) Len() int      { return len(c) }
func (c RemoteConvByMtime) Swap(i, j int) { c[i], c[j] = c[j], c[i] }
func (c RemoteConvByMtime) Less(i, j int) bool {
	return GetConvMtime(c[i]) > GetConvMtime(c[j])
}

type ConvLocalByTopicName []chat1.ConversationLocal

func (c ConvLocalByTopicName) Len() int      { return len(c) }
func (c ConvLocalByTopicName) Swap(i, j int) { c[i], c[j] = c[j], c[i] }
func (c ConvLocalByTopicName) Less(i, j int) bool {
	return c[i].Info.TopicName < c[j].Info.TopicName
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

func RemoteConv(conv chat1.Conversation) types.RemoteConversation {
	return types.RemoteConversation{
		Conv:      conv,
		ConvIDStr: conv.GetConvID().String(),
	}
}

func RemoteConvs(convs []chat1.Conversation) (res []types.RemoteConversation) {
	res = make([]types.RemoteConversation, 0, len(convs))
	for _, conv := range convs {
		res = append(res, RemoteConv(conv))
	}
	return res
}

func PluckConvs(rcs []types.RemoteConversation) (res []chat1.Conversation) {
	res = make([]chat1.Conversation, 0, len(rcs))
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

func MessageIDControlToPagination(ctx context.Context, logger DebugLabeler, control *chat1.MessageIDControl,
	conv *types.RemoteConversation) (res *chat1.Pagination) {
	if control == nil {
		return res
	}
	pag := pager.NewThreadPager()
	res = new(chat1.Pagination)
	res.Num = control.Num
	if control.Pivot != nil {
		var err error
		pm := pagerMsg{msgID: *control.Pivot}
		switch control.Mode {
		case chat1.MessageIDControlMode_OLDERMESSAGES:
			res.Next, err = pag.MakeIndex(pm)
		case chat1.MessageIDControlMode_NEWERMESSAGES:
			res.Previous, err = pag.MakeIndex(pm)
		case chat1.MessageIDControlMode_UNREADLINE:
			if conv == nil {
				// just bail out of here with no conversation
				logger.Debug(ctx, "MessageIDControlToPagination: unreadline mode with no conv, bailing")
				return nil
			}
			pm.msgID = conv.Conv.ReaderInfo.ReadMsgid
			fallthrough
		case chat1.MessageIDControlMode_CENTERED:
			// Heuristic that we might want to revisit, get older messages from a little ahead of where
			// we want to center on
			if conv == nil {
				// just bail out of here with no conversation
				logger.Debug(ctx, "MessageIDControlToPagination: centered mode with no conv, bailing")
				return nil
			}
			maxID := int(conv.Conv.MaxVisibleMsgID())
			desired := int(pm.msgID) + control.Num/2
			logger.Debug(ctx, "MessageIDControlToPagination: maxID: %d desired: %d", maxID, desired)
			if desired > maxID {
				desired = maxID
			}
			pm.msgID = chat1.MessageID(desired + 1)
			res.Next, err = pag.MakeIndex(pm)
			res.ForceFirstPage = true
		}
		if err != nil {
			return nil
		}
	}
	return res
}

// AssetsForMessage gathers all assets on a message
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
		if vis == keybase1.TLFVisibility_PUBLIC {
			return tlfName
		}

		username := g.Env.GetUsername().String()
		if len(tlfName) == 0 {
			return username
		}

		// KBFS creates TLFs with suffixes (e.g., folder names that
		// conflict after an assertion has been resolved) and readers,
		// so we need to handle those types of TLF names here so that
		// edit history works correctly.
		split1 := strings.SplitN(tlfName, " ", 2) // split off suffix
		split2 := strings.Split(split1[0], "#")   // split off readers
		// Add the name to the writers list (assume the current user
		// is a writer).
		tlfName = split2[0] + "," + username
		if len(split2) > 1 {
			// Re-append any readers.
			tlfName += "#" + split2[1]
		}
		if len(split1) > 1 {
			// Re-append any suffix.
			tlfName += " " + split1[1]
		}
		return tlfName
	default:
		return tlfName
	}
}

func ForceReloadUPAKsForUIDs(ctx context.Context, g *globals.Context, uids []keybase1.UID) error {
	getArg := func(i int) *libkb.LoadUserArg {
		if i >= len(uids) {
			return nil
		}
		tmp := libkb.NewLoadUserByUIDForceArg(g.GlobalContext, uids[i])
		return &tmp
	}
	return g.GetUPAKLoader().Batcher(ctx, getArg, nil, nil, 0)
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
	nist, _, _, err := g.ActiveDevice.NISTAndUIDDeviceID(ctx)
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
			err := errors.New("len(rawCA) == 0")
			log.Debug(ctx, "GetGregorConn: failed to parse CAs", err.Error())
			return conn, token, err
		}
		conn = rpc.NewTLSConnectionWithDialable(rpc.NewFixedRemote(uri.HostPort),
			[]byte(rawCA), libkb.NewContextifiedErrorUnwrapper(g.ExternalG()),
			handler(nist), libkb.NewRPCLogFactory(g.ExternalG()),
			logger.LogOutputWithDepthAdder{Logger: g.Log},
			rpc.DefaultMaxFrameLength, rpc.ConnectionOpts{},
			libkb.NewProxyDialable(g.Env))
	} else {
		t := rpc.NewConnectionTransportWithDialable(uri, nil, libkb.MakeWrapError(g.ExternalG()), rpc.DefaultMaxFrameLength, libkb.NewProxyDialable(g.GetEnv()))
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

func RemoveUnfurl(mvalid *chat1.MessageUnboxedValid, unfurlMessageID chat1.MessageID) {
	if mvalid.Unfurls == nil {
		return
	}
	delete(mvalid.Unfurls, unfurlMessageID)
}

// SuspendComponent will suspend a Suspendable type until the return function
// is called. This allows a succinct call like defer SuspendComponent(ctx, g,
// g.ConvLoader)() in RPC handlers wishing to lock out the conv loader.
func SuspendComponent(ctx context.Context, g *globals.Context, suspendable types.Suspendable) func() {
	if canceled := suspendable.Suspend(ctx); canceled {
		g.Log.CDebugf(ctx, "SuspendComponent: canceled background task")
	}
	return func() {
		suspendable.Resume(ctx)
	}
}

func SuspendComponents(ctx context.Context, g *globals.Context, suspendables []types.Suspendable) func() {
	resumeFuncs := []func(){}
	for _, s := range suspendables {
		resumeFuncs = append(resumeFuncs, SuspendComponent(ctx, g, s))
	}
	return func() {
		for _, f := range resumeFuncs {
			f()
		}
	}
}

func IsPermanentErr(err error) bool {
	if uberr, ok := err.(types.UnboxingError); ok {
		return uberr.IsPermanent()
	}
	return err != nil
}

func EphemeralLifetimeFromConv(ctx context.Context, g *globals.Context, conv chat1.ConversationLocal) (res *gregor1.DurationSec, err error) {
	// Check to see if the conversation has an exploding policy
	var retentionRes *gregor1.DurationSec
	var gregorRes *gregor1.DurationSec
	var rentTyp chat1.RetentionPolicyType
	var convSet bool
	if conv.ConvRetention != nil {
		if rentTyp, err = conv.ConvRetention.Typ(); err != nil {
			return res, err
		}
		if rentTyp == chat1.RetentionPolicyType_EPHEMERAL {
			e := conv.ConvRetention.Ephemeral()
			retentionRes = &e.Age
		}
		convSet = rentTyp != chat1.RetentionPolicyType_INHERIT
	}
	if !convSet && conv.TeamRetention != nil {
		if rentTyp, err = conv.TeamRetention.Typ(); err != nil {
			return res, err
		}
		if rentTyp == chat1.RetentionPolicyType_EPHEMERAL {
			e := conv.TeamRetention.Ephemeral()
			retentionRes = &e.Age
		}
	}

	// See if there is anything in Gregor
	st, err := g.GregorState.State(ctx)
	if err != nil {
		return res, err
	}
	// Note: this value is present on the JS frontend as well
	key := fmt.Sprintf("exploding:%s", conv.GetConvID())
	cat, err := gregor1.ObjFactory{}.MakeCategory(key)
	if err != nil {
		return res, err
	}
	items, err := st.ItemsWithCategoryPrefix(cat)
	if err != nil {
		return res, err
	}
	if len(items) > 0 {
		it := items[0]
		body := string(it.Body().Bytes())
		sec, err := strconv.ParseInt(body, 0, 0)
		if err != nil {
			return res, nil
		}
		gsec := gregor1.DurationSec(sec)
		gregorRes = &gsec
	}
	if retentionRes != nil && gregorRes != nil {
		if *gregorRes < *retentionRes {
			return gregorRes, nil
		}
		return retentionRes, nil
	} else if retentionRes != nil {
		return retentionRes, nil
	} else if gregorRes != nil {
		return gregorRes, nil
	} else {
		return nil, nil
	}
}

var decorateBegin = "$>kb$"
var decorateEnd = "$<kb$"
var decorateEscapeRe = regexp.MustCompile(`\\*\$\>kb\$`)

func EscapeForDecorate(ctx context.Context, body string) string {
	// escape any natural occurrences of begin so we don't bust markdown parser
	return decorateEscapeRe.ReplaceAllStringFunc(body, func(s string) string {
		if len(s)%2 != 0 {
			return `\` + s
		}
		return s
	})
}

func DecorateBody(ctx context.Context, body string, offset, length int, decoration interface{}) (res string, added int) {
	out, err := json.Marshal(decoration)
	if err != nil {
		return res, 0
	}
	//b64out := string(out)
	b64out := base64.StdEncoding.EncodeToString(out)
	strDecoration := fmt.Sprintf("%s%s%s", decorateBegin, b64out, decorateEnd)
	added = len(strDecoration) - length
	res = fmt.Sprintf("%s%s%s", body[:offset], strDecoration, body[offset+length:])
	return res, added
}

var linkRegexp = xurls.Relaxed()

// These indices correspond to the named capture groups in the xurls regexes
var linkRelaxedGroupIndex = 0
var linkStrictGroupIndex = 0
var mailtoRegexp = regexp.MustCompile(`(?:(?:[\w-_.]+)@(?:[\w-]+(?:\.[\w-]+)+))\b`)

func init() {
	for index, name := range linkRegexp.SubexpNames() {
		if name == "relaxed" {
			linkRelaxedGroupIndex = index + 1
		}
		if name == "strict" {
			linkStrictGroupIndex = index + 1
		}
	}
}

func DecorateWithLinks(ctx context.Context, body string) string {
	var added int
	offset := 0
	origBody := body

	shouldSkipLink := func(body string) bool {
		if strings.Contains(strings.Split(body, "/")[0], "@") {
			return true
		}
		for _, scheme := range xurls.SchemesNoAuthority {
			if strings.HasPrefix(body, scheme) {
				return true
			}
		}
		if strings.HasPrefix(body, "ftp://") || strings.HasPrefix(body, "gopher://") {
			return true
		}
		return false
	}
	allMatches := linkRegexp.FindAllStringSubmatchIndex(ReplaceQuotedSubstrings(body, true), -1)
	for _, match := range allMatches {
		var lowhit, highhit int
		if len(match) >= linkRelaxedGroupIndex*2 && match[linkRelaxedGroupIndex*2-2] >= 0 {
			lowhit = linkRelaxedGroupIndex*2 - 2
			highhit = linkRelaxedGroupIndex*2 - 1
		} else if len(match) >= linkStrictGroupIndex*2 && match[linkStrictGroupIndex*2-2] >= 0 {
			lowhit = linkStrictGroupIndex*2 - 2
			highhit = linkStrictGroupIndex*2 - 1
		} else {
			continue
		}

		bodyMatch := origBody[match[lowhit]:match[highhit]]
		url := bodyMatch
		var punycode string
		if shouldSkipLink(bodyMatch) {
			continue
		}
		if !(strings.HasPrefix(bodyMatch, "http://") || strings.HasPrefix(bodyMatch, "https://")) {
			url = "http://" + bodyMatch
		}
		if encoded, err := idna.ToASCII(url); err == nil && encoded != url {
			punycode = encoded
		}
		body, added = DecorateBody(ctx, body, match[lowhit]+offset, match[highhit]-match[lowhit],
			chat1.NewUITextDecorationWithLink(chat1.UILinkDecoration{
				Display:  bodyMatch,
				Url:      url,
				Punycode: punycode,
			}))
		offset += added
	}

	offset = 0
	origBody = body
	allMatches = mailtoRegexp.FindAllStringIndex(ReplaceQuotedSubstrings(body, true), -1)
	for _, match := range allMatches {
		if len(match) < 2 {
			continue
		}
		bodyMatch := origBody[match[0]:match[1]]
		url := "mailto:" + bodyMatch
		body, added = DecorateBody(ctx, body, match[0]+offset, match[1]-match[0],
			chat1.NewUITextDecorationWithMailto(chat1.UILinkDecoration{
				Display: bodyMatch,
				Url:     url,
			}))
		offset += added
	}

	return body
}

func DecorateWithMentions(ctx context.Context, body string, atMentions []string,
	maybeMentions []chat1.MaybeMention, chanMention chat1.ChannelMention,
	channelNameMentions []chat1.ChannelNameMention) string {
	var added int
	offset := 0
	if len(atMentions) > 0 || len(maybeMentions) > 0 || chanMention != chat1.ChannelMention_NONE {
		atMap := make(map[string]bool)
		for _, at := range atMentions {
			atMap[at] = true
		}
		maybeMap := make(map[string]chat1.MaybeMention)
		for _, tm := range maybeMentions {
			name := tm.Name
			if len(tm.Channel) > 0 {
				name += "#" + tm.Channel
			}
			maybeMap[name] = tm
		}
		inputBody := body
		atMatches := parseRegexpNames(ctx, inputBody, atMentionRegExp)
		for _, m := range atMatches {
			switch {
			case m.normalizedName == "here":
				fallthrough
			case m.normalizedName == "channel":
				fallthrough
			case m.normalizedName == "everyone":
				if chanMention == chat1.ChannelMention_NONE {
					continue
				}
				fallthrough
			case atMap[m.normalizedName]:
				body, added = DecorateBody(ctx, body, m.position[0]+offset-1, m.Len()+1,
					chat1.NewUITextDecorationWithAtmention(m.name))
				offset += added
			}
			if tm, ok := maybeMap[m.name]; ok {
				body, added = DecorateBody(ctx, body, m.position[0]+offset-1, m.Len()+1,
					chat1.NewUITextDecorationWithMaybemention(tm))
				offset += added
			}
		}
	}
	if len(channelNameMentions) > 0 {
		chanMap := make(map[string]chat1.ConversationID)
		for _, c := range channelNameMentions {
			chanMap[c.TopicName] = c.ConvID
		}
		offset = 0
		inputBody := body
		chanMatches := parseRegexpNames(ctx, inputBody, chanNameMentionRegExp)
		for _, c := range chanMatches {
			convID, ok := chanMap[c.name]
			if !ok {
				continue
			}
			body, added = DecorateBody(ctx, body, c.position[0]+offset-1, c.Len()+1,
				chat1.NewUITextDecorationWithChannelnamemention(chat1.UIChannelNameMention{
					Name:   c.name,
					ConvID: convID.String(),
				}))
			offset += added
		}
	}
	return body
}

func EscapeShrugs(ctx context.Context, body string) string {
	return strings.Replace(body, `¯\_(ツ)_/¯`, `¯\\\_(ツ)_/¯`, -1)
}

var startQuote = ">"
var newline = []rune("\n")

var blockQuoteRegex = regexp.MustCompile("((?s)```.*?```)")
var quoteRegex = regexp.MustCompile("((?s)`.*?`)")

func ReplaceQuotedSubstrings(xs string, skipAngleQuotes bool) string {
	replacer := func(s string) string {
		return strings.Repeat("$", len(s))
	}
	xs = blockQuoteRegex.ReplaceAllStringFunc(xs, replacer)
	xs = quoteRegex.ReplaceAllStringFunc(xs, replacer)

	// Remove all quoted lines. Because we removed all codeblocks
	// before, we only need to consider single lines.
	var ret []string
	for _, line := range strings.Split(xs, string(newline)) {
		if skipAngleQuotes || !strings.HasPrefix(strings.TrimLeft(line, " "), startQuote) {
			ret = append(ret, line)
		} else {
			ret = append(ret, replacer(line))
		}
	}
	return strings.Join(ret, string(newline))
}

var ErrGetUnverifiedConvNotFound = errors.New("GetUnverifiedConv: conversation not found")
var ErrGetVerifiedConvNotFound = errors.New("GetVerifiedConv: conversation not found")

func GetUnverifiedConv(ctx context.Context, g *globals.Context, uid gregor1.UID,
	convID chat1.ConversationID, dataSource types.InboxSourceDataSourceTyp) (res types.RemoteConversation, err error) {

	inbox, err := g.InboxSource.ReadUnverified(ctx, uid, dataSource, &chat1.GetInboxQuery{
		ConvIDs:      []chat1.ConversationID{convID},
		MemberStatus: chat1.AllConversationMemberStatuses(),
	})
	if err != nil {
		return res, err
	}
	if len(inbox.ConvsUnverified) == 0 {
		return res, ErrGetUnverifiedConvNotFound
	}
	if !inbox.ConvsUnverified[0].GetConvID().Eq(convID) {
		return res, fmt.Errorf("GetUnverifiedConv: convID mismatch: %s != %s",
			inbox.ConvsUnverified[0].ConvIDStr, convID)
	}
	return inbox.ConvsUnverified[0], nil
}

func FormatConversationName(info chat1.ConversationInfoLocal, myUsername string) string {
	switch info.TeamType {
	case chat1.TeamType_COMPLEX:
		if len(info.TlfName) > 0 && len(info.TopicName) > 0 {
			return fmt.Sprintf("%s#%s", info.TlfName, info.TopicName)
		}
		return info.TlfName
	case chat1.TeamType_SIMPLE:
		return info.TlfName
	case chat1.TeamType_NONE:
		users := info.Participants
		if len(users) == 1 {
			return ""
		}
		var usersWithoutYou []string
		for _, user := range users {
			if user.Username != myUsername && user.InConvName {
				usersWithoutYou = append(usersWithoutYou, user.Username)
			}
		}
		return strings.Join(usersWithoutYou, ",")
	default:
		return ""
	}
}

func GetVerifiedConv(ctx context.Context, g *globals.Context, uid gregor1.UID,
	convID chat1.ConversationID, dataSource types.InboxSourceDataSourceTyp) (res chat1.ConversationLocal, err error) {
	// in case we are being called from within some cancelable context, remove
	// it for the purposes of this call, since whatever this is is likely a
	// side effect we don't want to get stuck
	ctx = globals.CtxRemoveLocalizerCancelable(ctx)
	inbox, _, err := g.InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking, dataSource, nil,
		&chat1.GetInboxLocalQuery{
			ConvIDs:      []chat1.ConversationID{convID},
			MemberStatus: chat1.AllConversationMemberStatuses(),
		})
	if err != nil {
		return res, err
	}
	if len(inbox.Convs) == 0 {
		return res, ErrGetVerifiedConvNotFound
	}
	if !inbox.Convs[0].GetConvID().Eq(convID) {
		return res, fmt.Errorf("GetVerifiedConv: convID mismatch: %s != %s",
			inbox.Convs[0].GetConvID(), convID)
	}
	return inbox.Convs[0], nil
}

func IsMapUnfurl(msg chat1.MessageUnboxed) bool {
	if !msg.IsValid() {
		return false
	}
	body := msg.Valid().MessageBody
	if !body.IsType(chat1.MessageType_UNFURL) {
		return false
	}
	unfurl := body.Unfurl()
	typ, err := unfurl.Unfurl.Unfurl.UnfurlType()
	if err != nil {
		return false
	}
	if typ != chat1.UnfurlType_GENERIC {
		return false
	}
	return body.Unfurl().Unfurl.Unfurl.Generic().MapInfo != nil
}

func DedupStringLists(lists ...[]string) (res []string) {
	seen := make(map[string]struct{})
	for _, list := range lists {
		for _, x := range list {
			if _, ok := seen[x]; !ok {
				seen[x] = struct{}{}
				res = append(res, x)
			}
		}
	}
	return res
}

func DBConvLess(a pager.InboxEntry, b pager.InboxEntry) bool {
	if a.GetMtime() > b.GetMtime() {
		return true
	} else if a.GetMtime() < b.GetMtime() {
		return false
	}
	return !(a.GetConvID().Eq(b.GetConvID()) || a.GetConvID().Less(b.GetConvID()))
}
