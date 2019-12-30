package chat1

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"flag"
	"fmt"
	"hash"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

// we will show some representation of an exploded message in the UI for a week
const ShowExplosionLifetime = time.Hour * 24 * 7

// If a conversation is larger, only admins can @channel.
const MaxChanMentionConvSize = 100

type ByUID []gregor1.UID
type ConvIDShort = []byte

func (b ByUID) Len() int      { return len(b) }
func (b ByUID) Swap(i, j int) { b[i], b[j] = b[j], b[i] }
func (b ByUID) Less(i, j int) bool {
	return bytes.Compare(b[i].Bytes(), b[j].Bytes()) < 0
}

// Eq compares two TLFIDs
func (id TLFID) Eq(other TLFID) bool {
	return bytes.Equal([]byte(id), []byte(other))
}

// EqString is like EqualsTo, except that it accepts a fmt.Stringer. This
// can be useful for comparing keybase1.TLFID and chat1.TLFID.
func (id TLFID) EqString(other fmt.Stringer) bool {
	return hex.EncodeToString(id) == other.String()
}

func (id TLFID) String() string {
	return hex.EncodeToString(id)
}

func (id TLFID) Bytes() []byte {
	return []byte(id)
}

func (id TLFID) IsNil() bool {
	return len(id) == 0
}

func (id TLFID) IsTeamID() bool {
	if len(id) != keybase1.TEAMID_LEN {
		return false
	}
	switch id[len(id)-1] {
	case keybase1.TEAMID_PRIVATE_SUFFIX,
		keybase1.TEAMID_PUBLIC_SUFFIX,
		keybase1.SUB_TEAMID_PRIVATE_SUFFIX,
		keybase1.SUB_TEAMID_PUBLIC_SUFFIX:
		return true
	default:
		return false
	}
}

func MakeConvID(val string) (ConversationID, error) {
	return hex.DecodeString(val)
}

func (cid ConversationID) String() string {
	return hex.EncodeToString(cid)
}

func (cid ConversationID) Bytes() []byte {
	return []byte(cid)
}

func (cid ConversationID) IsNil() bool {
	return len(cid) < DbShortFormLen
}

func (cid ConversationID) Eq(c ConversationID) bool {
	return bytes.Equal(cid, c)
}

func (cid ConversationID) Less(c ConversationID) bool {
	return bytes.Compare(cid, c) < 0
}

const DbShortFormLen = 10

// DbShortForm should only be used when interacting with the database, and should
// never leave Gregor
func (cid ConversationID) DbShortForm() ConvIDShort {
	end := DbShortFormLen
	if end > len(cid) {
		end = len(cid)
	}
	return cid[:end]
}

func (cid ConversationID) DbShortFormString() string {
	return DbShortFormToString(cid.DbShortForm())
}

func DbShortFormToString(cid ConvIDShort) string {
	return hex.EncodeToString(cid)
}

func DbShortFormFromString(cid string) (ConvIDShort, error) {
	return hex.DecodeString(cid)
}

func MakeTLFID(val string) (TLFID, error) {
	return hex.DecodeString(val)
}

func MakeTopicID(val string) (TopicID, error) {
	return hex.DecodeString(val)
}

func MakeTopicType(val int64) TopicType {
	return TopicType(val)
}

func (mid MessageID) String() string {
	return strconv.FormatUint(uint64(mid), 10)
}

func (mid MessageID) Min(mid2 MessageID) MessageID {
	if mid < mid2 {
		return mid
	}
	return mid2
}

func (mid MessageID) IsNil() bool {
	return uint(mid) == 0
}

func (mid MessageID) Advance(num uint) MessageID {
	return MessageID(uint(mid) + num)
}

func (t MessageType) String() string {
	s, ok := MessageTypeRevMap[t]
	if ok {
		return s
	}
	return "UNKNOWN"
}

// Message types deletable by a standard DELETE message.
var deletableMessageTypesByDelete = []MessageType{
	MessageType_TEXT,
	MessageType_ATTACHMENT,
	MessageType_EDIT,
	MessageType_ATTACHMENTUPLOADED,
	MessageType_REACTION,
	MessageType_REQUESTPAYMENT,
	MessageType_UNFURL,
	MessageType_PIN,
}

// Messages types NOT deletable by a DELETEHISTORY message.
var nonDeletableMessageTypesByDeleteHistory = []MessageType{
	MessageType_NONE,
	MessageType_DELETE,
	MessageType_METADATA,
	MessageType_TLFNAME,
	MessageType_HEADLINE,
	MessageType_DELETEHISTORY,
}

func DeletableMessageTypesByDelete() []MessageType {
	return deletableMessageTypesByDelete
}

var visibleMessageTypes = []MessageType{
	MessageType_TEXT,
	MessageType_ATTACHMENT,
	MessageType_SYSTEM,
	MessageType_SENDPAYMENT,
	MessageType_REQUESTPAYMENT,
	MessageType_FLIP,
	MessageType_HEADLINE,
	MessageType_PIN,
}

func VisibleChatMessageTypes() []MessageType {
	return visibleMessageTypes
}

var editableMessageTypesByEdit = []MessageType{
	MessageType_TEXT,
}

func EditableMessageTypesByEdit() []MessageType {
	return editableMessageTypesByEdit
}

func IsEphemeralSupersederType(typ MessageType) bool {
	switch typ {
	case MessageType_EDIT,
		MessageType_ATTACHMENTUPLOADED,
		MessageType_REACTION,
		MessageType_UNFURL:
		return true
	default:
		return false
	}
}

func IsEphemeralNonSupersederType(typ MessageType) bool {
	switch typ {
	case MessageType_TEXT,
		MessageType_ATTACHMENT,
		MessageType_FLIP:
		return true
	default:
		return false
	}
}

func IsEphemeralType(typ MessageType) bool {
	return IsEphemeralNonSupersederType(typ) || IsEphemeralSupersederType(typ)
}

func DeletableMessageTypesByDeleteHistory() (res []MessageType) {
	banned := make(map[MessageType]bool)
	for _, mt := range nonDeletableMessageTypesByDeleteHistory {
		banned[mt] = true
	}
	for _, mt := range MessageTypeMap {
		if !banned[mt] {
			res = append(res, mt)
		}
	}
	sort.Slice(res, func(i, j int) bool {
		return res[i] < res[j]
	})
	return res
}

func IsDeletableByDelete(typ MessageType) bool {
	for _, typ2 := range deletableMessageTypesByDelete {
		if typ == typ2 {
			return true
		}
	}
	return false
}

func IsDeletableByDeleteHistory(typ MessageType) bool {
	for _, typ2 := range nonDeletableMessageTypesByDeleteHistory {
		if typ == typ2 {
			return false
		}
	}
	return true
}

func (t TopicType) String() string {
	s, ok := TopicTypeRevMap[t]
	if ok {
		return s
	}
	return "UNKNOWN"
}

func (t TopicID) String() string {
	return hex.EncodeToString(t)
}

func (t ConversationIDTriple) Eq(other ConversationIDTriple) bool {
	return t.Tlfid.Eq(other.Tlfid) &&
		bytes.Equal([]byte(t.TopicID), []byte(other.TopicID)) &&
		t.TopicType == other.TopicType
}

func (hash Hash) String() string {
	return hex.EncodeToString(hash)
}

func (hash Hash) Eq(other Hash) bool {
	return bytes.Equal(hash, other)
}

func (m MessageUnboxed) OutboxID() *OutboxID {
	if state, err := m.State(); err == nil {
		switch state {
		case MessageUnboxedState_VALID:
			return m.Valid().ClientHeader.OutboxID
		case MessageUnboxedState_ERROR:
			return nil
		case MessageUnboxedState_PLACEHOLDER:
			return nil
		case MessageUnboxedState_OUTBOX:
			return m.Outbox().Msg.ClientHeader.OutboxID
		default:
			return nil
		}
	}
	return nil
}

func (m MessageUnboxed) GetMessageID() MessageID {
	if state, err := m.State(); err == nil {
		switch state {
		case MessageUnboxedState_VALID:
			return m.Valid().ServerHeader.MessageID
		case MessageUnboxedState_ERROR:
			return m.Error().MessageID
		case MessageUnboxedState_PLACEHOLDER:
			return m.Placeholder().MessageID
		case MessageUnboxedState_OUTBOX:
			return m.Outbox().Msg.ClientHeader.OutboxInfo.Prev
		case MessageUnboxedState_JOURNEYCARD:
			return m.Journeycard().PrevID
		default:
			return 0
		}
	}
	return 0
}

func (m MessageUnboxed) GetOutboxID() *OutboxID {
	if state, err := m.State(); err == nil {
		switch state {
		case MessageUnboxedState_VALID:
			return m.Valid().ClientHeader.OutboxID
		case MessageUnboxedState_ERROR:
			return nil
		case MessageUnboxedState_PLACEHOLDER:
			return nil
		case MessageUnboxedState_OUTBOX:
			obid := m.Outbox().OutboxID
			return &obid
		case MessageUnboxedState_JOURNEYCARD:
			return nil
		default:
			return nil
		}
	}
	return nil
}

func (m MessageUnboxed) GetTopicType() TopicType {
	if state, err := m.State(); err == nil {
		switch state {
		case MessageUnboxedState_VALID:
			return m.Valid().ClientHeader.Conv.TopicType
		case MessageUnboxedState_ERROR:
			return TopicType_NONE
		case MessageUnboxedState_OUTBOX:
			return m.Outbox().Msg.ClientHeader.Conv.TopicType
		case MessageUnboxedState_PLACEHOLDER:
			return TopicType_NONE
		case MessageUnboxedState_JOURNEYCARD:
			return TopicType_NONE
		}
	}
	return TopicType_NONE
}

func (m MessageUnboxed) GetMessageType() MessageType {
	if state, err := m.State(); err == nil {
		switch state {
		case MessageUnboxedState_VALID:
			return m.Valid().ClientHeader.MessageType
		case MessageUnboxedState_ERROR:
			return m.Error().MessageType
		case MessageUnboxedState_OUTBOX:
			return m.Outbox().Msg.ClientHeader.MessageType
		case MessageUnboxedState_PLACEHOLDER:
			// All we know about a place holder is the ID, so just
			// call it type NONE
			return MessageType_NONE
		case MessageUnboxedState_JOURNEYCARD:
			return MessageType_NONE
		}
	}
	return MessageType_NONE
}

func (m MessageUnboxed) IsValid() bool {
	if state, err := m.State(); err == nil {
		return state == MessageUnboxedState_VALID
	}
	return false
}

func (m MessageUnboxed) IsError() bool {
	if state, err := m.State(); err == nil {
		return state == MessageUnboxedState_ERROR
	}
	return false
}

func (m MessageUnboxed) IsOutbox() bool {
	if state, err := m.State(); err == nil {
		return state == MessageUnboxedState_OUTBOX
	}
	return false
}

func (m MessageUnboxed) IsPlaceholder() bool {
	if state, err := m.State(); err == nil {
		return state == MessageUnboxedState_PLACEHOLDER
	}
	return false
}

func (m MessageUnboxed) IsJourneycard() bool {
	if state, err := m.State(); err == nil {
		return state == MessageUnboxedState_JOURNEYCARD
	}
	return false
}

// IsValidFull returns whether the message is both:
// 1. Valid
// 2. Has a non-deleted body with a type matching the header
//    (TLFNAME is an exception as it has no body)
func (m MessageUnboxed) IsValidFull() bool {
	if !m.IsValid() {
		return false
	}
	valid := m.Valid()
	headerType := valid.ClientHeader.MessageType
	switch headerType {
	case MessageType_NONE:
		return false
	case MessageType_TLFNAME:
		// Skip body check
		return true
	}
	bodyType, err := valid.MessageBody.MessageType()
	if err != nil {
		return false
	}
	return bodyType == headerType
}

// IsValidDeleted returns whether a message is valid and has been deleted.
// This statement does not hold: IsValidFull != IsValidDeleted
func (m MessageUnboxed) IsValidDeleted() bool {
	if !m.IsValid() {
		return false
	}
	valid := m.Valid()
	headerType := valid.ClientHeader.MessageType
	switch headerType {
	case MessageType_NONE:
		return false
	case MessageType_TLFNAME:
		// Undeletable and may have no body
		return false
	}
	bodyType, err := valid.MessageBody.MessageType()
	if err != nil {
		return false
	}
	return bodyType == MessageType_NONE
}

func (m MessageUnboxed) IsVisible() bool {
	typ := m.GetMessageType()
	for _, visType := range VisibleChatMessageTypes() {
		if typ == visType {
			return true
		}
	}
	return false
}

func (m MessageUnboxed) HasReactions() bool {
	if !m.IsValid() {
		return false
	}
	return len(m.Valid().Reactions.Reactions) > 0
}

func (m MessageUnboxed) HasUnfurls() bool {
	if !m.IsValid() {
		return false
	}
	return len(m.Valid().Unfurls) > 0
}

func (m MessageUnboxed) SearchableText() string {
	if !m.IsValidFull() {
		return ""
	}
	return m.Valid().MessageBody.SearchableText()
}

func (m MessageUnboxed) SenderUsername() string {
	if !m.IsValid() {
		return ""
	}
	return m.Valid().SenderUsername
}

func (m MessageUnboxed) Ctime() gregor1.Time {
	if !m.IsValid() {
		return 0
	}
	return m.Valid().ServerHeader.Ctime
}

func (m MessageUnboxed) AtMentionUsernames() []string {
	if !m.IsValid() {
		return nil
	}
	return m.Valid().AtMentionUsernames
}

func (m MessageUnboxed) ChannelMention() ChannelMention {
	if !m.IsValid() {
		return ChannelMention_NONE
	}
	return m.Valid().ChannelMention
}

func (m MessageUnboxed) SenderIsBot() bool {
	if m.IsValid() {
		valid := m.Valid()
		return gregor1.UIDPtrEq(valid.ClientHeader.BotUID, &valid.ClientHeader.Sender)
	}
	return false
}

func (m *MessageUnboxed) DebugString() string {
	if m == nil {
		return "[nil]"
	}
	state, err := m.State()
	if err != nil {
		return fmt.Sprintf("[INVALID err:%v]", err)
	}
	if state == MessageUnboxedState_ERROR {
		merr := m.Error()
		return fmt.Sprintf("[%v %v mt:%v (%v) (%v)]", state, m.GetMessageID(), merr.ErrType, merr.ErrMsg, merr.InternalErrMsg)
	}
	switch state {
	case MessageUnboxedState_VALID:
		valid := m.Valid()
		headerType := valid.ClientHeader.MessageType
		s := fmt.Sprintf("%v %v", state, valid.ServerHeader.MessageID)
		bodyType, err := valid.MessageBody.MessageType()
		if err != nil {
			return fmt.Sprintf("[INVALID-BODY err:%v]", err)
		}
		if headerType == bodyType {
			s = fmt.Sprintf("%v %v", s, headerType)
		} else {
			if headerType == MessageType_TLFNAME {
				s = fmt.Sprintf("%v h:%v (b:%v)", s, headerType, bodyType)
			} else {
				s = fmt.Sprintf("%v h:%v != b:%v", s, headerType, bodyType)
			}
		}
		if valid.ServerHeader.SupersededBy != 0 {
			s = fmt.Sprintf("%v supBy:%v", s, valid.ServerHeader.SupersededBy)
		}
		return fmt.Sprintf("[%v]", s)
	case MessageUnboxedState_OUTBOX:
		obr := m.Outbox()
		ostateStr := "CORRUPT"
		ostate, err := obr.State.State()
		if err != nil {
			ostateStr = "CORRUPT"
		} else {
			ostateStr = fmt.Sprintf("%v", ostate)
		}
		return fmt.Sprintf("[%v obid:%v prev:%v ostate:%v %v]",
			state, obr.OutboxID, obr.Msg.ClientHeader.OutboxInfo.Prev, ostateStr, obr.Msg.ClientHeader.MessageType)
	case MessageUnboxedState_JOURNEYCARD:
		jc := m.Journeycard()
		return fmt.Sprintf("[JOURNEYCARD %v]", jc.CardType)
	default:
		return fmt.Sprintf("[state:%v %v]", state, m.GetMessageID())
	}
}

func MessageUnboxedDebugStrings(ms []MessageUnboxed) (res []string) {
	for _, m := range ms {
		res = append(res, m.DebugString())
	}
	return res
}

func MessageUnboxedDebugList(ms []MessageUnboxed) string {
	return fmt.Sprintf("{ %v %v }", len(ms), strings.Join(MessageUnboxedDebugStrings(ms), ","))
}

func MessageUnboxedDebugLines(ms []MessageUnboxed) string {
	return strings.Join(MessageUnboxedDebugStrings(ms), "\n")
}

const (
	VersionErrorMessageBoxed VersionKind = "messageboxed"
	VersionErrorHeader       VersionKind = "header"
	VersionErrorBody         VersionKind = "body"
)

// NOTE: these values correspond to the maximum accepted values in
// chat/boxer.go. If these values are changed, they must also be accepted
// there.
var MaxMessageBoxedVersion MessageBoxedVersion = MessageBoxedVersion_V4
var MaxHeaderVersion HeaderPlaintextVersion = HeaderPlaintextVersion_V1
var MaxBodyVersion BodyPlaintextVersion = BodyPlaintextVersion_V2

// ParseableVersion checks if this error has a version that is now able to be
// understood by our client.
func (m MessageUnboxedError) ParseableVersion() bool {
	switch m.ErrType {
	case MessageUnboxedErrorType_BADVERSION, MessageUnboxedErrorType_BADVERSION_CRITICAL:
		// only applies to these types
	default:
		return false
	}

	kind := m.VersionKind
	version := m.VersionNumber
	// This error was stored from an old client, we have parse out the info we
	// need from the error message.
	// TODO remove this check once it has be live for a few cycles.
	if kind == "" && version == 0 {
		re := regexp.MustCompile(`.* Chat version error: \[ unhandled: (\w+) version: (\d+) .*\]`)
		matches := re.FindStringSubmatch(m.ErrMsg)
		if len(matches) != 3 {
			return false
		}
		kind = VersionKind(matches[1])
		var err error
		version, err = strconv.Atoi(matches[2])
		if err != nil {
			return false
		}
	}

	var maxVersion int
	switch kind {
	case VersionErrorMessageBoxed:
		maxVersion = int(MaxMessageBoxedVersion)
	case VersionErrorHeader:
		maxVersion = int(MaxHeaderVersion)
	case VersionErrorBody:
		maxVersion = int(MaxBodyVersion)
	default:
		return false
	}
	return maxVersion >= version
}

func (m MessageUnboxedError) IsEphemeralError() bool {
	return m.IsEphemeral && (m.ErrType == MessageUnboxedErrorType_EPHEMERAL || m.ErrType == MessageUnboxedErrorType_PAIRWISE_MISSING)
}

func (m MessageUnboxedValid) AsDeleteHistory() (res MessageDeleteHistory, err error) {
	if m.ClientHeader.MessageType != MessageType_DELETEHISTORY {
		return res, fmt.Errorf("message is %v not %v", m.ClientHeader.MessageType, MessageType_DELETEHISTORY)
	}
	if m.MessageBody.IsNil() {
		return res, fmt.Errorf("missing message body")
	}
	btyp, err := m.MessageBody.MessageType()
	if err != nil {
		return res, err
	}
	if btyp != MessageType_DELETEHISTORY {
		return res, fmt.Errorf("message has wrong body type: %v", btyp)
	}
	return m.MessageBody.Deletehistory(), nil
}

func (m *MsgEphemeralMetadata) String() string {
	if m == nil {
		return "<nil>"
	}
	var explodedBy string
	if m.ExplodedBy == nil {
		explodedBy = "<nil>"
	} else {
		explodedBy = *m.ExplodedBy
	}
	return fmt.Sprintf("{ Lifetime: %v, Generation: %v, ExplodedBy: %v }", m.Lifetime.ToDuration(), m.Generation, explodedBy)
}

func (m MessagePlaintext) MessageType() MessageType {
	typ, err := m.MessageBody.MessageType()
	if err != nil {
		return MessageType_NONE
	}
	return typ
}

func (m MessagePlaintext) IsVisible() bool {
	typ := m.MessageType()
	for _, visType := range VisibleChatMessageTypes() {
		if typ == visType {
			return true
		}
	}
	return false
}

func (m MessagePlaintext) IsBadgableType() bool {
	typ := m.MessageType()
	switch typ {
	case MessageType_TEXT, MessageType_ATTACHMENT:
		return true
	default:
		return false
	}
}

func (m MessagePlaintext) SearchableText() string {
	return m.MessageBody.SearchableText()
}

func (m MessagePlaintext) IsEphemeral() bool {
	return m.EphemeralMetadata() != nil
}

func (m MessagePlaintext) EphemeralMetadata() *MsgEphemeralMetadata {
	return m.ClientHeader.EphemeralMetadata
}

func (o *MsgEphemeralMetadata) Eq(r *MsgEphemeralMetadata) bool {
	if o != nil && r != nil {
		return *o == *r
	}
	return (o == nil) && (r == nil)
}

func (m MessageUnboxedValid) HasPairwiseMacs() bool {
	return m.ClientHeader.HasPairwiseMacs
}

func (m MessageUnboxedValid) IsEphemeral() bool {
	return m.EphemeralMetadata() != nil
}

func (m MessageUnboxedValid) EphemeralMetadata() *MsgEphemeralMetadata {
	return m.ClientHeader.EphemeralMetadata
}

func (m MessageUnboxedValid) ExplodedBy() *string {
	if !m.IsEphemeral() {
		return nil
	}
	return m.EphemeralMetadata().ExplodedBy
}

func Etime(lifetime gregor1.DurationSec, ctime, rtime, now gregor1.Time) gregor1.Time {
	originalLifetime := lifetime.ToDuration()
	elapsedLifetime := now.Time().Sub(ctime.Time())
	remainingLifetime := originalLifetime - elapsedLifetime
	// If the server's view doesn't make sense, just use the signed lifetime
	// from the message.
	if remainingLifetime > originalLifetime {
		remainingLifetime = originalLifetime
	}
	etime := rtime.Time().Add(remainingLifetime)
	return gregor1.ToTime(etime)
}

func (m MessageUnboxedValid) Etime() gregor1.Time {
	// The server sends us (untrusted) ctime of the message and server's view
	// of now. We use these to calculate the remaining lifetime on an ephemeral
	// message, returning an etime based on our received time.
	metadata := m.EphemeralMetadata()
	if metadata == nil {
		return 0
	}
	header := m.ServerHeader
	return Etime(metadata.Lifetime, header.Ctime, m.ClientHeader.Rtime, header.Now)
}

func (m MessageUnboxedValid) RemainingEphemeralLifetime(now time.Time) time.Duration {
	remainingLifetime := m.Etime().Time().Sub(now).Round(time.Second)
	return remainingLifetime
}

func (m MessageUnboxedValid) IsEphemeralExpired(now time.Time) bool {
	if !m.IsEphemeral() {
		return false
	}
	etime := m.Etime().Time()
	// There are a few ways a message could be considered expired
	// 1. Our body is already nil (deleted from DELETEHISTORY or a server purge)
	// 2. We were "exploded now"
	// 3. Our lifetime is up
	return m.MessageBody.IsNil() || m.EphemeralMetadata().ExplodedBy != nil || etime.Before(now) || etime.Equal(now)
}

func (m MessageUnboxedValid) HideExplosion(maxDeletedUpto MessageID, now time.Time) bool {
	if !m.IsEphemeral() {
		return false
	}
	etime := m.Etime()
	// Don't show ash lines for messages that have been expunged.
	return etime.Time().Add(ShowExplosionLifetime).Before(now) || m.ServerHeader.MessageID < maxDeletedUpto
}

func (b MessageBody) IsNil() bool {
	return b == MessageBody{}
}

func (b MessageBody) IsType(typ MessageType) bool {
	btyp, err := b.MessageType()
	if err != nil {
		return false
	}
	return btyp == typ
}

func (b MessageBody) SearchableText() string {
	typ, err := b.MessageType()
	if err != nil {
		return ""
	}
	switch typ {
	case MessageType_TEXT:
		return b.Text().Body
	case MessageType_EDIT:
		return b.Edit().Body
	case MessageType_REQUESTPAYMENT:
		return b.Requestpayment().Note
	case MessageType_ATTACHMENT:
		return b.Attachment().GetTitle()
	case MessageType_FLIP:
		return b.Flip().Text
	case MessageType_UNFURL:
		return b.Unfurl().SearchableText()
	default:
		return ""
	}
}

func (m UIMessage) IsValid() bool {
	if state, err := m.State(); err == nil {
		return state == MessageUnboxedState_VALID
	}
	return false
}

func (m UIMessage) IsOutbox() bool {
	if state, err := m.State(); err == nil {
		return state == MessageUnboxedState_OUTBOX
	}
	return false
}

func (m UIMessage) IsPlaceholder() bool {
	if state, err := m.State(); err == nil {
		return state == MessageUnboxedState_PLACEHOLDER
	}
	return false
}

func (m UIMessage) GetMessageID() MessageID {
	if state, err := m.State(); err == nil {
		if state == MessageUnboxedState_VALID {
			return m.Valid().MessageID
		}
		if state == MessageUnboxedState_ERROR {
			return m.Error().MessageID
		}
		if state == MessageUnboxedState_PLACEHOLDER {
			return m.Placeholder().MessageID
		}
	}
	return 0
}

func (m UIMessage) GetOutboxID() *OutboxID {
	if state, err := m.State(); err == nil {
		if state == MessageUnboxedState_VALID {
			strOutboxID := m.Valid().OutboxID
			if strOutboxID != nil {
				outboxID, err := MakeOutboxID(*strOutboxID)
				if err != nil {
					return nil
				}
				return &outboxID
			}
			return nil
		}
		if state == MessageUnboxedState_ERROR {
			return nil
		}
		if state == MessageUnboxedState_PLACEHOLDER {
			return nil
		}
	}
	return nil
}

func (m UIMessage) GetMessageType() MessageType {
	state, err := m.State()
	if err != nil {
		return MessageType_NONE
	}
	switch state {
	case MessageUnboxedState_VALID:
		body := m.Valid().MessageBody
		typ, err := body.MessageType()
		if err != nil {
			return MessageType_NONE
		}
		return typ
	case MessageUnboxedState_ERROR:
		return m.Error().MessageType
	case MessageUnboxedState_OUTBOX:
		return m.Outbox().MessageType
	default:
		return MessageType_NONE
	}
}

func (m UIMessage) SearchableText() string {
	if !m.IsValid() {
		return ""
	}
	return m.Valid().MessageBody.SearchableText()
}

func (m UIMessage) IsEphemeral() bool {
	state, err := m.State()
	if err != nil {
		return false
	}
	switch state {
	case MessageUnboxedState_VALID:
		return m.Valid().IsEphemeral
	case MessageUnboxedState_ERROR:
		return m.Error().IsEphemeral
	default:
		return false
	}
}

func (m MessageBoxed) GetMessageID() MessageID {
	return m.ServerHeader.MessageID
}

func (m MessageBoxed) GetMessageType() MessageType {
	return m.ClientHeader.MessageType
}

func (m MessageBoxed) Summary() MessageSummary {
	s := MessageSummary{
		MsgID:       m.GetMessageID(),
		MessageType: m.GetMessageType(),
		TlfName:     m.ClientHeader.TlfName,
		TlfPublic:   m.ClientHeader.TlfPublic,
	}
	if m.ServerHeader != nil {
		s.Ctime = m.ServerHeader.Ctime
	}
	return s
}

func (m MessageBoxed) OutboxInfo() *OutboxInfo {
	return m.ClientHeader.OutboxInfo
}

func (m MessageBoxed) KBFSEncrypted() bool {
	return m.ClientHeader.KbfsCryptKeysUsed == nil || *m.ClientHeader.KbfsCryptKeysUsed
}

func (m MessageBoxed) EphemeralMetadata() *MsgEphemeralMetadata {
	return m.ClientHeader.EphemeralMetadata
}

func (m MessageBoxed) IsEphemeral() bool {
	return m.EphemeralMetadata() != nil
}

func (m MessageBoxed) Etime() gregor1.Time {
	// The server sends us (untrusted) ctime of the message and server's view
	// of now. We use these to calculate the remaining lifetime on an ephemeral
	// message, returning an etime based on the current time.
	metadata := m.EphemeralMetadata()
	if metadata == nil {
		return 0
	}
	rtime := gregor1.ToTime(time.Now())
	if m.ServerHeader.Rtime != nil {
		rtime = *m.ServerHeader.Rtime
	}
	return Etime(metadata.Lifetime, m.ServerHeader.Ctime, rtime, m.ServerHeader.Now)
}

func (m MessageBoxed) IsEphemeralExpired(now time.Time) bool {
	if !m.IsEphemeral() {
		return false
	}
	etime := m.Etime().Time()
	return m.EphemeralMetadata().ExplodedBy != nil || etime.Before(now) || etime.Equal(now)
}

var ConversationStatusGregorMap = map[ConversationStatus]string{
	ConversationStatus_UNFILED:  "unfiled",
	ConversationStatus_FAVORITE: "favorite",
	ConversationStatus_IGNORED:  "ignored",
	ConversationStatus_BLOCKED:  "blocked",
	ConversationStatus_MUTED:    "muted",
	ConversationStatus_REPORTED: "reported",
}

var ConversationStatusGregorRevMap = map[string]ConversationStatus{
	"unfiled":  ConversationStatus_UNFILED,
	"favorite": ConversationStatus_FAVORITE,
	"ignored":  ConversationStatus_IGNORED,
	"blocked":  ConversationStatus_BLOCKED,
	"muted":    ConversationStatus_MUTED,
	"reported": ConversationStatus_REPORTED,
}

var sha256Pool = sync.Pool{
	New: func() interface{} {
		return sha256.New()
	},
}

func (t ConversationIDTriple) Hash() []byte {
	h := sha256Pool.Get().(hash.Hash)
	defer sha256Pool.Put(h)
	h.Reset()
	h.Write(t.Tlfid)
	h.Write(t.TopicID)
	h.Write([]byte(strconv.Itoa(int(t.TopicType))))
	hash := h.Sum(nil)

	return hash
}

func (t ConversationIDTriple) ToConversationID(shardID [2]byte) ConversationID {
	h := t.Hash()
	h[0], h[1] = shardID[0], shardID[1]
	return ConversationID(h)
}

func (t ConversationIDTriple) Derivable(cid ConversationID) bool {
	h := t.Hash()
	if len(h) <= 2 || len(cid) <= 2 {
		return false
	}
	return bytes.Equal(h[2:], []byte(cid[2:]))
}

func MakeOutboxID(s string) (OutboxID, error) {
	b, err := hex.DecodeString(s)
	return OutboxID(b), err
}

func (o *OutboxID) Eq(r *OutboxID) bool {
	if o != nil && r != nil {
		return bytes.Equal(*o, *r)
	}
	return (o == nil) && (r == nil)
}

func (o OutboxID) String() string {
	return hex.EncodeToString(o)
}

func (o OutboxID) Bytes() []byte {
	return []byte(o)
}

func (o *OutboxInfo) Eq(r *OutboxInfo) bool {
	if o != nil && r != nil {
		return *o == *r
	}
	return (o == nil) && (r == nil)
}

func (o OutboxRecord) IsError() bool {
	state, err := o.State.State()
	if err != nil {
		return false
	}
	return state == OutboxStateType_ERROR
}

func (o OutboxRecord) IsSending() bool {
	state, err := o.State.State()
	if err != nil {
		return false
	}
	return state == OutboxStateType_SENDING
}

func (o OutboxRecord) IsAttachment() bool {
	return o.Msg.ClientHeader.MessageType == MessageType_ATTACHMENT
}

func (o OutboxRecord) IsUnfurl() bool {
	return o.Msg.ClientHeader.MessageType == MessageType_UNFURL
}

func (o OutboxRecord) IsChatFlip() bool {
	return o.Msg.ClientHeader.MessageType == MessageType_FLIP &&
		o.Msg.ClientHeader.Conv.TopicType == TopicType_CHAT
}

func (o OutboxRecord) MessageType() MessageType {
	return o.Msg.ClientHeader.MessageType
}

func (p MessagePreviousPointer) Eq(other MessagePreviousPointer) bool {
	return (p.Id == other.Id) && (p.Hash.Eq(other.Hash))
}

// Visibility is a helper to get around a nil pointer for visibility,
// and to get around TLFVisibility_ANY.  The default is PRIVATE.
// Note:  not sure why visibility is a pointer, or what TLFVisibility_ANY
// is for, but don't want to change the API.
func (q *GetInboxLocalQuery) Visibility() keybase1.TLFVisibility {
	visibility := keybase1.TLFVisibility_PRIVATE
	if q.TlfVisibility != nil && *q.TlfVisibility == keybase1.TLFVisibility_PUBLIC {
		visibility = keybase1.TLFVisibility_PUBLIC
	}
	return visibility
}

// Visibility is a helper to get around a nil pointer for visibility,
// and to get around TLFVisibility_ANY.  The default is PRIVATE.
// Note:  not sure why visibility is a pointer, or what TLFVisibility_ANY
// is for, but don't want to change the API.
func (q *GetInboxQuery) Visibility() keybase1.TLFVisibility {
	visibility := keybase1.TLFVisibility_PRIVATE
	if q.TlfVisibility != nil && *q.TlfVisibility == keybase1.TLFVisibility_PUBLIC {
		visibility = keybase1.TLFVisibility_PUBLIC
	}
	return visibility
}

// TLFNameExpanded returns a TLF name with a reset suffix if it exists.
// This version can be used in requests to lookup the TLF.
func (c ConversationInfoLocal) TLFNameExpanded() string {
	return ExpandTLFName(c.TlfName, c.FinalizeInfo)
}

// TLFNameExpandedSummary returns a TLF name with a summary of the
// account reset if there was one.
// This version is for display purposes only and cannot be used to lookup the TLF.
func (c ConversationInfoLocal) TLFNameExpandedSummary() string {
	if c.FinalizeInfo == nil {
		return c.TlfName
	}
	return c.TlfName + " " + c.FinalizeInfo.BeforeSummary()
}

// TLFNameExpanded returns a TLF name with a reset suffix if it exists.
// This version can be used in requests to lookup the TLF.
func (h MessageClientHeader) TLFNameExpanded(finalizeInfo *ConversationFinalizeInfo) string {
	return ExpandTLFName(h.TlfName, finalizeInfo)
}

// TLFNameExpanded returns a TLF name with a reset suffix if it exists.
// This version can be used in requests to lookup the TLF.
func (m MessageSummary) TLFNameExpanded(finalizeInfo *ConversationFinalizeInfo) string {
	return ExpandTLFName(m.TlfName, finalizeInfo)
}

func (h MessageClientHeaderVerified) TLFNameExpanded(finalizeInfo *ConversationFinalizeInfo) string {
	return ExpandTLFName(h.TlfName, finalizeInfo)
}

func (h MessageClientHeader) ToVerifiedForTesting() MessageClientHeaderVerified {
	if flag.Lookup("test.v") == nil {
		panic("MessageClientHeader.ToVerifiedForTesting used outside of test")
	}
	return MessageClientHeaderVerified{
		Conv:         h.Conv,
		TlfName:      h.TlfName,
		TlfPublic:    h.TlfPublic,
		MessageType:  h.MessageType,
		Prev:         h.Prev,
		Sender:       h.Sender,
		SenderDevice: h.SenderDevice,
		OutboxID:     h.OutboxID,
		OutboxInfo:   h.OutboxInfo,
	}
}

// ExpandTLFName returns a TLF name with a reset suffix if it exists.
// This version can be used in requests to lookup the TLF.
func ExpandTLFName(name string, finalizeInfo *ConversationFinalizeInfo) string {
	if finalizeInfo == nil {
		return name
	}
	if len(finalizeInfo.ResetFull) == 0 {
		return name
	}
	if strings.Contains(name, " account reset ") {
		return name
	}
	return name + " " + finalizeInfo.ResetFull
}

// BeforeSummary returns a summary of the finalize without "files" in it.
// The canonical name for a TLF after reset has a "(files before ... account reset...)" suffix
// which doesn't make much sense in other uses (like chat).
func (f *ConversationFinalizeInfo) BeforeSummary() string {
	return fmt.Sprintf("(before %s account reset %s)", f.ResetUser, f.ResetDate)
}

func (f *ConversationFinalizeInfo) IsResetForUser(username string) bool {
	// If reset user is the given user, or is blank (only way such a thing
	// could be in our inbox is if the current user is the one that reset)
	return f != nil && (f.ResetUser == username || f.ResetUser == "")
}

func (p *Pagination) Eq(other *Pagination) bool {
	if p == nil && other == nil {
		return true
	}
	if p != nil && other != nil {
		return p.Last == other.Last && bytes.Equal(p.Next, other.Next) &&
			bytes.Equal(p.Previous, other.Previous) && p.Num == other.Num
	}
	return false
}

func (p *Pagination) String() string {
	if p == nil {
		return "<nil>"
	}
	return fmt.Sprintf("[Num: %d n: %s p: %s last: %v]", p.Num, hex.EncodeToString(p.Next),
		hex.EncodeToString(p.Previous), p.Last)
}

// FirstPage returns true if the pagination object is not pointing in any direction
func (p *Pagination) FirstPage() bool {
	return p == nil || p.ForceFirstPage || (len(p.Next) == 0 && len(p.Previous) == 0)
}

func (c ConversationLocal) GetMtime() gregor1.Time {
	return c.ReaderInfo.Mtime
}

func (c ConversationLocal) GetConvID() ConversationID {
	return c.Info.Id
}

func (c ConversationLocal) GetTopicType() TopicType {
	return c.Info.Triple.TopicType
}

func (c ConversationLocal) GetMembersType() ConversationMembersType {
	return c.Info.MembersType
}

func (c ConversationLocal) GetTeamType() TeamType {
	return c.Info.TeamType
}

func (c ConversationLocal) GetFinalizeInfo() *ConversationFinalizeInfo {
	return c.Info.FinalizeInfo
}

func (c ConversationLocal) GetTopicName() string {
	return c.Info.TopicName
}

func (c ConversationLocal) GetExpunge() *Expunge {
	return &c.Expunge
}

func (c ConversationLocal) IsPublic() bool {
	return c.Info.Visibility == keybase1.TLFVisibility_PUBLIC
}

func (c ConversationLocal) GetMaxMessage(typ MessageType) (MessageSummary, error) {
	for _, msg := range c.MaxMessages {
		if msg.GetMessageType() == typ {
			return msg, nil
		}
	}
	return MessageSummary{}, fmt.Errorf("max message not found: %v", typ)
}

func (c ConversationLocal) GetMaxDeletedUpTo() MessageID {
	var maxExpungeID, maxDelHID MessageID
	if expunge := c.GetExpunge(); expunge != nil {
		maxExpungeID = expunge.Upto
	}
	if maxDelH, err := c.GetMaxMessage(MessageType_DELETEHISTORY); err != nil {
		maxDelHID = maxDelH.GetMessageID()
	}
	if maxExpungeID > maxDelHID {
		return maxExpungeID
	}
	return maxDelHID
}

func maxVisibleMsgIDFromSummaries(maxMessages []MessageSummary) MessageID {
	visibleTyps := VisibleChatMessageTypes()
	visibleTypsMap := map[MessageType]bool{}
	for _, typ := range visibleTyps {
		visibleTypsMap[typ] = true
	}
	maxMsgID := MessageID(0)
	for _, msg := range maxMessages {
		if _, ok := visibleTypsMap[msg.GetMessageType()]; ok && msg.GetMessageID() > maxMsgID {
			maxMsgID = msg.GetMessageID()
		}
	}
	return maxMsgID
}

func (c ConversationLocal) MaxVisibleMsgID() MessageID {
	return maxVisibleMsgIDFromSummaries(c.MaxMessages)
}

func (c ConversationLocal) ConvNameNames() (res []string) {
	for _, p := range c.Info.Participants {
		if p.InConvName {
			res = append(res, p.Username)
		}
	}
	return res
}

func (c ConversationLocal) AllNames() (res []string) {
	for _, p := range c.Info.Participants {
		res = append(res, p.Username)
	}
	return res
}

func (c ConversationLocal) FullNamesForSearch() (res []*string) {
	for _, p := range c.Info.Participants {
		res = append(res, p.Fullname)
	}
	return res
}

func (c ConversationLocal) CannotWrite() bool {
	if c.ConvSettings == nil {
		return false
	}
	if c.ConvSettings.MinWriterRoleInfo == nil {
		return false
	}

	return c.ConvSettings.MinWriterRoleInfo.CannotWrite
}

func (c Conversation) GetMtime() gregor1.Time {
	return c.ReaderInfo.Mtime
}

func (c Conversation) GetConvID() ConversationID {
	return c.Metadata.ConversationID
}

func (c Conversation) GetTopicType() TopicType {
	return c.Metadata.IdTriple.TopicType
}

func (c Conversation) GetMembersType() ConversationMembersType {
	return c.Metadata.MembersType
}

func (c Conversation) GetTeamType() TeamType {
	return c.Metadata.TeamType
}

func (c Conversation) GetFinalizeInfo() *ConversationFinalizeInfo {
	return c.Metadata.FinalizeInfo
}

func (c Conversation) GetExpunge() *Expunge {
	return &c.Expunge
}

func (c Conversation) IsPublic() bool {
	return c.Metadata.Visibility == keybase1.TLFVisibility_PUBLIC
}

var errMaxMessageNotFound = errors.New("max message not found")

func (c Conversation) GetMaxMessage(typ MessageType) (MessageSummary, error) {
	for _, msg := range c.MaxMsgSummaries {
		if msg.GetMessageType() == typ {
			return msg, nil
		}
	}
	return MessageSummary{}, errMaxMessageNotFound
}

func (c Conversation) Includes(uid gregor1.UID) bool {
	for _, auid := range c.Metadata.ActiveList {
		if uid.Eq(auid) {
			return true
		}
	}
	return false
}

func (c Conversation) GetMaxDeletedUpTo() MessageID {
	var maxExpungeID, maxDelHID MessageID
	if expunge := c.GetExpunge(); expunge != nil {
		maxExpungeID = expunge.Upto
	}
	if maxDelH, err := c.GetMaxMessage(MessageType_DELETEHISTORY); err != nil {
		maxDelHID = maxDelH.GetMessageID()
	}
	if maxExpungeID > maxDelHID {
		return maxExpungeID
	}
	return maxDelHID
}

func (c Conversation) GetMaxMessageID() MessageID {
	maxMsgID := MessageID(0)
	for _, msg := range c.MaxMsgSummaries {
		if msg.GetMessageID() > maxMsgID {
			maxMsgID = msg.GetMessageID()
		}
	}
	return maxMsgID
}

func (c Conversation) IsSelfFinalized(username string) bool {
	return c.GetMembersType() == ConversationMembersType_KBFS && c.GetFinalizeInfo().IsResetForUser(username)
}

func (c Conversation) MaxVisibleMsgID() MessageID {
	return maxVisibleMsgIDFromSummaries(c.MaxMsgSummaries)
}

func (c Conversation) IsUnread() bool {
	return c.IsUnreadFromMsgID(c.ReaderInfo.ReadMsgid)
}

func (c Conversation) IsUnreadFromMsgID(readMsgID MessageID) bool {
	maxMsgID := c.MaxVisibleMsgID()
	return maxMsgID > 0 && maxMsgID > readMsgID
}

func (c Conversation) HasMemberStatus(status ConversationMemberStatus) bool {
	if c.ReaderInfo != nil {
		return c.ReaderInfo.Status == status
	}
	return false
}

func (m MessageSummary) GetMessageID() MessageID {
	return m.MsgID
}

func (m MessageSummary) GetMessageType() MessageType {
	return m.MessageType
}

/*
func ConvertMessageBodyV1ToV2(v1 MessageBodyV1) (MessageBody, error) {
	t, err := v1.MessageType()
	if err != nil {
		return MessageBody{}, err
	}
	switch t {
	case MessageType_TEXT:
		return NewMessageBodyWithText(v1.Text()), nil
	case MessageType_ATTACHMENT:
		previous := v1.Attachment()
		upgraded := MessageAttachment{
			Object:   previous.Object,
			Metadata: previous.Metadata,
			Uploaded: true,
		}
		if previous.Preview != nil {
			upgraded.Previews = []Asset{*previous.Preview}
		}
		return NewMessageBodyWithAttachment(upgraded), nil
	case MessageType_EDIT:
		return NewMessageBodyWithEdit(v1.Edit()), nil
	case MessageType_DELETE:
		return NewMessageBodyWithDelete(v1.Delete()), nil
	case MessageType_METADATA:
		return NewMessageBodyWithMetadata(v1.Metadata()), nil
	case MessageType_HEADLINE:
		return NewMessageBodyWithHeadline(v1.Headline()), nil
	case MessageType_NONE:
		return MessageBody{MessageType__: MessageType_NONE}, nil
	}

	return MessageBody{}, fmt.Errorf("ConvertMessageBodyV1ToV2: unhandled message type %v", t)
}
*/

func (a *MerkleRoot) Eq(b *MerkleRoot) bool {
	if a != nil && b != nil {
		return (a.Seqno == b.Seqno) && bytes.Equal(a.Hash, b.Hash)
	}
	return (a == nil) && (b == nil)
}

func (d *SealedData) AsEncrypted() EncryptedData {
	return EncryptedData{
		V: d.V,
		E: d.E,
		N: d.N,
	}
}

func (d *SealedData) AsSignEncrypted() SignEncryptedData {
	return SignEncryptedData{
		V: d.V,
		E: d.E,
		N: d.N,
	}
}

func (d *EncryptedData) AsSealed() SealedData {
	return SealedData{
		V: d.V,
		E: d.E,
		N: d.N,
	}
}

func (d *SignEncryptedData) AsSealed() SealedData {
	return SealedData{
		V: d.V,
		E: d.E,
		N: d.N,
	}
}

func NewConversationErrorLocal(
	message string,
	remoteConv Conversation,
	unverifiedTLFName string,
	typ ConversationErrorType,
	rekeyInfo *ConversationErrorRekey,
) *ConversationErrorLocal {
	return &ConversationErrorLocal{
		Typ:               typ,
		Message:           message,
		RemoteConv:        remoteConv,
		UnverifiedTLFName: unverifiedTLFName,
		RekeyInfo:         rekeyInfo,
	}
}

type OfflinableResult interface {
	SetOffline()
}

func (r *NonblockFetchRes) SetOffline() {
	r.Offline = true
}

func (r *UnreadlineRes) SetOffline() {
	r.Offline = true
}

func (r *MarkAsReadLocalRes) SetOffline() {
	r.Offline = true
}

func (r *GetInboxAndUnboxLocalRes) SetOffline() {
	r.Offline = true
}

func (r *GetInboxAndUnboxUILocalRes) SetOffline() {
	r.Offline = true
}

func (r *GetThreadLocalRes) SetOffline() {
	r.Offline = true
}

func (r *GetInboxSummaryForCLILocalRes) SetOffline() {
	r.Offline = true
}

func (r *GetConversationForCLILocalRes) SetOffline() {
	r.Offline = true
}

func (r *GetMessagesLocalRes) SetOffline() {
	r.Offline = true
}

func (r *GetNextAttachmentMessageLocalRes) SetOffline() {
	r.Offline = true
}

func (r *FindConversationsLocalRes) SetOffline() {
	r.Offline = true
}

func (r *JoinLeaveConversationLocalRes) SetOffline() {
	r.Offline = true
}

func (r *PreviewConversationLocalRes) SetOffline() {
	r.Offline = true
}

func (r *GetTLFConversationsLocalRes) SetOffline() {
	r.Offline = true
}

func (r *SetAppNotificationSettingsLocalRes) SetOffline() {
	r.Offline = true
}

func (r *DeleteConversationLocalRes) SetOffline() {
	r.Offline = true
}

func (r *SearchRegexpRes) SetOffline() {
	r.Offline = true
}

func (r *SearchInboxRes) SetOffline() {
	r.Offline = true
}

func (t TyperInfo) String() string {
	return fmt.Sprintf("typer(u:%s d:%s)", t.Username, t.DeviceName)
}

func (o TLFConvOrdinal) Int() int {
	return int(o)
}

func (o TLFConvOrdinal) IsFirst() bool {
	return o.Int() == 1
}

func MakeEmptyUnreadUpdate(convID ConversationID) UnreadUpdate {
	counts := make(map[keybase1.DeviceType]int)
	counts[keybase1.DeviceType_DESKTOP] = 0
	counts[keybase1.DeviceType_MOBILE] = 0
	return UnreadUpdate{
		ConvID:                  convID,
		UnreadMessages:          0,
		UnreadNotifyingMessages: counts,
	}
}

func (u UnreadUpdate) String() string {
	return fmt.Sprintf("[d:%v c:%s u:%d nd:%d nm:%d]", u.Diff, u.ConvID, u.UnreadMessages,
		u.UnreadNotifyingMessages[keybase1.DeviceType_DESKTOP],
		u.UnreadNotifyingMessages[keybase1.DeviceType_MOBILE])
}

func (s TopicNameState) Bytes() []byte {
	return []byte(s)
}

func (s TopicNameState) Eq(o TopicNameState) bool {
	return bytes.Equal(s.Bytes(), o.Bytes())
}

func (i InboxUIItem) GetConvID() ConversationID {
	bConvID, _ := hex.DecodeString(i.ConvID)
	return ConversationID(bConvID)
}

func (i InboxUIItem) ExportToSummary() (s ConvSummary) {
	s.Id = i.ConvID
	s.Unread = i.ReadMsgID < i.MaxVisibleMsgID
	s.ActiveAt = i.Time.UnixSeconds()
	s.ActiveAtMs = i.Time.UnixMilliseconds()
	s.FinalizeInfo = i.FinalizeInfo
	s.MemberStatus = strings.ToLower(i.MemberStatus.String())
	for _, super := range i.Supersedes {
		s.Supersedes = append(s.Supersedes,
			super.ConversationID.String())
	}
	for _, super := range i.SupersededBy {
		s.SupersededBy = append(s.SupersededBy,
			super.ConversationID.String())
	}
	switch i.MembersType {
	case ConversationMembersType_IMPTEAMUPGRADE, ConversationMembersType_IMPTEAMNATIVE:
		s.ResetUsers = i.ResetParticipants
	}
	s.Channel = ChatChannel{
		Name:        i.Name,
		Public:      i.IsPublic,
		TopicType:   strings.ToLower(i.TopicType.String()),
		MembersType: strings.ToLower(i.MembersType.String()),
		TopicName:   i.Channel,
	}
	return s
}

type ByConversationMemberStatus []ConversationMemberStatus

func (m ByConversationMemberStatus) Len() int           { return len(m) }
func (m ByConversationMemberStatus) Swap(i, j int)      { m[i], m[j] = m[j], m[i] }
func (m ByConversationMemberStatus) Less(i, j int) bool { return m[i] > m[j] }

func AllConversationMemberStatuses() (res []ConversationMemberStatus) {
	for status := range ConversationMemberStatusRevMap {
		res = append(res, status)
	}
	sort.Sort(ByConversationMemberStatus(res))
	return res
}

type ByConversationExistence []ConversationExistence

func (m ByConversationExistence) Len() int           { return len(m) }
func (m ByConversationExistence) Swap(i, j int)      { m[i], m[j] = m[j], m[i] }
func (m ByConversationExistence) Less(i, j int) bool { return m[i] > m[j] }

func AllConversationExistences() (res []ConversationExistence) {
	for existence := range ConversationExistenceRevMap {
		res = append(res, existence)
	}
	sort.Sort(ByConversationExistence(res))
	return res
}

func (v InboxVers) ToConvVers() ConversationVers {
	return ConversationVers(v)
}

func (p ConversationIDMessageIDPairs) Contains(convID ConversationID) (MessageID, bool) {
	for _, c := range p.Pairs {
		if c.ConvID.Eq(convID) {
			return c.MsgID, true
		}
	}
	return MessageID(0), false
}

func (c ConversationMemberStatus) ToGregorDBString() (string, error) {
	s, ok := ConversationMemberStatusRevMap[c]
	if !ok {
		return "", fmt.Errorf("unrecoginzed ConversationMemberStatus: %v", c)
	}
	return strings.ToLower(s), nil
}

func (c ConversationMemberStatus) ToGregorDBStringAssert() string {
	s, err := c.ToGregorDBString()
	if err != nil {
		panic(err)
	}
	return s
}

func humanizeDuration(duration time.Duration) string {
	var value float64
	var unit string
	if int(duration.Hours()) >= 24 {
		value = duration.Hours() / 24
		unit = "day"
	} else if int(duration.Hours()) >= 1 {
		value = duration.Hours()
		unit = "hour"
	} else if int(duration.Minutes()) >= 1 {
		value = duration.Minutes()
		unit = "minute"
	} else if int(duration.Seconds()) >= 1 {
		value = duration.Seconds()
		unit = "second"
	} else {
		return ""
	}
	if int(value) > 1 {
		unit = unit + "s"
	}
	return fmt.Sprintf("%.0f %s", value, unit)
}

func (p RetentionPolicy) Eq(o RetentionPolicy) bool {
	typ1, err := p.Typ()
	if err != nil {
		return false
	}

	typ2, err := o.Typ()
	if err != nil {
		return false
	}
	if typ1 != typ2 {
		return false
	}
	switch typ1 {
	case RetentionPolicyType_NONE:
		return true
	case RetentionPolicyType_RETAIN:
		return p.Retain() == o.Retain()
	case RetentionPolicyType_EXPIRE:
		return p.Expire() == o.Expire()
	case RetentionPolicyType_INHERIT:
		return p.Inherit() == o.Inherit()
	case RetentionPolicyType_EPHEMERAL:
		return p.Ephemeral() == o.Ephemeral()
	default:
		return false
	}
}

func (p RetentionPolicy) HumanSummary() (summary string) {
	typ, err := p.Typ()
	if err != nil {
		return ""
	}

	switch typ {
	case RetentionPolicyType_NONE, RetentionPolicyType_RETAIN:
		summary = "be retained indefinitely"
	case RetentionPolicyType_EXPIRE:
		duration := humanizeDuration(p.Expire().Age.ToDuration())
		if duration != "" {
			summary = fmt.Sprintf("expire after %s", duration)
		}
	case RetentionPolicyType_EPHEMERAL:
		duration := humanizeDuration(p.Ephemeral().Age.ToDuration())
		if duration != "" {
			summary = fmt.Sprintf("explode after %s by default", duration)
		}
	}
	if summary != "" {
		summary = fmt.Sprintf("Messages will %s", summary)
	}
	return summary
}

func (p RetentionPolicy) Summary() string {
	typ, err := p.Typ()
	if err != nil {
		return "{variant error}"
	}
	switch typ {
	case RetentionPolicyType_EXPIRE:
		return fmt.Sprintf("{%v age:%v}", typ, p.Expire().Age.ToDuration())
	case RetentionPolicyType_EPHEMERAL:
		return fmt.Sprintf("{%v age:%v}", typ, p.Ephemeral().Age.ToDuration())
	default:
		return fmt.Sprintf("{%v}", typ)
	}
}

func TeamIDToTLFID(teamID keybase1.TeamID) (TLFID, error) {
	return MakeTLFID(teamID.String())
}

func (r *NonblockFetchRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *NonblockFetchRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *UnreadlineRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *UnreadlineRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *MarkAsReadLocalRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *MarkAsReadLocalRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *GetInboxAndUnboxLocalRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *GetInboxAndUnboxLocalRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *GetAllResetConvMembersRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *GetAllResetConvMembersRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *LoadFlipRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *LoadFlipRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *GetInboxAndUnboxUILocalRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *GetInboxAndUnboxUILocalRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *GetThreadLocalRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *GetThreadLocalRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *NewConversationLocalRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *NewConversationLocalRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *GetInboxSummaryForCLILocalRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *GetInboxSummaryForCLILocalRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *GetMessagesLocalRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *GetMessagesLocalRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *GetNextAttachmentMessageLocalRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *GetNextAttachmentMessageLocalRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *SetConversationStatusLocalRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *SetConversationStatusLocalRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *PostLocalRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *PostLocalRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *GetConversationForCLILocalRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *GetConversationForCLILocalRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *PostLocalNonblockRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *PostLocalNonblockRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *DownloadAttachmentLocalRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *DownloadAttachmentLocalRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *DownloadFileAttachmentLocalRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *DownloadFileAttachmentLocalRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *FindConversationsLocalRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *FindConversationsLocalRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *JoinLeaveConversationLocalRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *JoinLeaveConversationLocalRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *PreviewConversationLocalRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *PreviewConversationLocalRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *DeleteConversationLocalRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *DeleteConversationLocalRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *GetTLFConversationsLocalRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *GetTLFConversationsLocalRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *SetAppNotificationSettingsLocalRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *SetAppNotificationSettingsLocalRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *SearchRegexpRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *SearchRegexpRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *SearchInboxRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *SearchInboxRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *GetInboxRemoteRes) GetRateLimit() (res []RateLimit) {
	if r.RateLimit != nil {
		res = []RateLimit{*r.RateLimit}
	}
	return res
}

func (r *GetInboxRemoteRes) SetRateLimits(rl []RateLimit) {
	r.RateLimit = &rl[0]
}

func (r *GetInboxByTLFIDRemoteRes) GetRateLimit() (res []RateLimit) {
	if r.RateLimit != nil {
		res = []RateLimit{*r.RateLimit}
	}
	return res
}

func (r *GetInboxByTLFIDRemoteRes) SetRateLimits(rl []RateLimit) {
	r.RateLimit = &rl[0]
}

func (r *GetThreadRemoteRes) GetRateLimit() (res []RateLimit) {
	if r.RateLimit != nil {
		res = []RateLimit{*r.RateLimit}
	}
	return res
}

func (r *GetThreadRemoteRes) SetRateLimits(rl []RateLimit) {
	r.RateLimit = &rl[0]
}

func (r *GetConversationMetadataRemoteRes) GetRateLimit() (res []RateLimit) {
	if r.RateLimit != nil {
		res = []RateLimit{*r.RateLimit}
	}
	return res
}

func (r *GetConversationMetadataRemoteRes) SetRateLimits(rl []RateLimit) {
	r.RateLimit = &rl[0]
}

func (r *PostRemoteRes) GetRateLimit() (res []RateLimit) {
	if r.RateLimit != nil {
		res = []RateLimit{*r.RateLimit}
	}
	return res
}

func (r *PostRemoteRes) SetRateLimits(rl []RateLimit) {
	r.RateLimit = &rl[0]
}

func (r *NewConversationRemoteRes) GetRateLimit() (res []RateLimit) {
	if r.RateLimit != nil {
		res = []RateLimit{*r.RateLimit}
	}
	return res
}

func (r *NewConversationRemoteRes) SetRateLimits(rl []RateLimit) {
	r.RateLimit = &rl[0]
}

func (r *GetMessagesRemoteRes) GetRateLimit() (res []RateLimit) {
	if r.RateLimit != nil {
		res = []RateLimit{*r.RateLimit}
	}
	return res
}

func (r *GetMessagesRemoteRes) SetRateLimits(rl []RateLimit) {
	r.RateLimit = &rl[0]
}

func (r *MarkAsReadRes) GetRateLimit() (res []RateLimit) {
	if r.RateLimit != nil {
		res = []RateLimit{*r.RateLimit}
	}
	return res
}

func (r *MarkAsReadRes) SetRateLimits(rl []RateLimit) {
	r.RateLimit = &rl[0]
}

func (r *SetConversationStatusRes) GetRateLimit() (res []RateLimit) {
	if r.RateLimit != nil {
		res = []RateLimit{*r.RateLimit}
	}
	return res
}

func (r *SetConversationStatusRes) SetRateLimits(rl []RateLimit) {
	r.RateLimit = &rl[0]
}

func (r *GetPublicConversationsRes) GetRateLimit() (res []RateLimit) {
	if r.RateLimit != nil {
		res = []RateLimit{*r.RateLimit}
	}
	return res
}

func (r *GetPublicConversationsRes) SetRateLimits(rl []RateLimit) {
	r.RateLimit = &rl[0]
}

func (r *JoinLeaveConversationRemoteRes) GetRateLimit() (res []RateLimit) {
	if r.RateLimit != nil {
		res = []RateLimit{*r.RateLimit}
	}
	return res
}

func (r *JoinLeaveConversationRemoteRes) SetRateLimits(rl []RateLimit) {
	r.RateLimit = &rl[0]
}

func (r *DeleteConversationRemoteRes) GetRateLimit() (res []RateLimit) {
	if r.RateLimit != nil {
		res = []RateLimit{*r.RateLimit}
	}
	return res
}

func (r *DeleteConversationRemoteRes) SetRateLimits(rl []RateLimit) {
	r.RateLimit = &rl[0]
}

func (r *GetMessageBeforeRes) GetRateLimit() (res []RateLimit) {
	if r.RateLimit != nil {
		res = []RateLimit{*r.RateLimit}
	}
	return res
}

func (r *GetMessageBeforeRes) SetRateLimits(rl []RateLimit) {
	r.RateLimit = &rl[0]
}

func (r *GetTLFConversationsRes) GetRateLimit() (res []RateLimit) {
	if r.RateLimit != nil {
		res = []RateLimit{*r.RateLimit}
	}
	return res
}

func (r *GetTLFConversationsRes) SetRateLimits(rl []RateLimit) {
	r.RateLimit = &rl[0]
}

func (r *SetAppNotificationSettingsRes) GetRateLimit() (res []RateLimit) {
	if r.RateLimit != nil {
		res = []RateLimit{*r.RateLimit}
	}
	return res
}

func (r *SetAppNotificationSettingsRes) SetRateLimits(rl []RateLimit) {
	r.RateLimit = &rl[0]
}

func (r *SetRetentionRes) GetRateLimit() (res []RateLimit) {
	if r.RateLimit != nil {
		res = []RateLimit{*r.RateLimit}
	}
	return res
}

func (r *SetRetentionRes) SetRateLimits(rl []RateLimit) {
	r.RateLimit = &rl[0]
}

func (r *LoadGalleryRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *LoadGalleryRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *ListBotCommandsLocalRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *ListBotCommandsLocalRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *PinMessageRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *PinMessageRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *ClearBotCommandsLocalRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *ClearBotCommandsLocalRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *ClearBotCommandsRes) GetRateLimit() (res []RateLimit) {
	if r.RateLimit != nil {
		res = []RateLimit{*r.RateLimit}
	}
	return res
}

func (r *ClearBotCommandsRes) SetRateLimits(rl []RateLimit) {
	r.RateLimit = &rl[0]
}

func (r *AdvertiseBotCommandsLocalRes) GetRateLimit() []RateLimit {
	return r.RateLimits
}

func (r *AdvertiseBotCommandsLocalRes) SetRateLimits(rl []RateLimit) {
	r.RateLimits = rl
}

func (r *AdvertiseBotCommandsRes) GetRateLimit() (res []RateLimit) {
	if r.RateLimit != nil {
		res = []RateLimit{*r.RateLimit}
	}
	return res
}

func (r *AdvertiseBotCommandsRes) SetRateLimits(rl []RateLimit) {
	r.RateLimit = &rl[0]
}

func (r *GetBotInfoRes) GetRateLimit() (res []RateLimit) {
	if r.RateLimit != nil {
		res = []RateLimit{*r.RateLimit}
	}
	return res
}

func (r *GetBotInfoRes) SetRateLimits(rl []RateLimit) {
	r.RateLimit = &rl[0]
}

func (i EphemeralPurgeInfo) String() string {
	return fmt.Sprintf("EphemeralPurgeInfo{ ConvID: %v, IsActive: %v, NextPurgeTime: %v, MinUnexplodedID: %v }",
		i.ConvID, i.IsActive, i.NextPurgeTime.Time(), i.MinUnexplodedID)
}

func (i EphemeralPurgeInfo) Eq(o EphemeralPurgeInfo) bool {
	return (i.IsActive == o.IsActive &&
		i.MinUnexplodedID == o.MinUnexplodedID &&
		i.NextPurgeTime == o.NextPurgeTime &&
		i.ConvID.Eq(o.ConvID))
}

func (r ReactionMap) HasReactionFromUser(reactionText, username string) (found bool, reactionMsgID MessageID) {
	reactions, ok := r.Reactions[reactionText]
	if !ok {
		return false, 0
	}
	reaction, ok := reactions[username]
	return ok, reaction.ReactionMsgID
}

func (r MessageReaction) Eq(o MessageReaction) bool {
	return r.Body == o.Body && r.MessageID == o.MessageID
}

func (i *ConversationMinWriterRoleInfoLocal) String() string {
	if i == nil {
		return "Minimum writer role for this conversation is not set."
	}
	changedBySuffix := "."
	if i.ChangedBy != "" {
		changedBySuffix = fmt.Sprintf(", last set by %v.", i.ChangedBy)
	}
	return fmt.Sprintf("Minimum writer role for this conversation is %v%v", i.Role, changedBySuffix)
}

func (s *ConversationSettings) IsNil() bool {
	return s == nil || s.MinWriterRoleInfo == nil
}

func (o SearchOpts) Matches(msg MessageUnboxed) bool {
	if o.SentAfter != 0 && msg.Ctime() < o.SentAfter {
		return false
	}
	if o.SentBefore != 0 && msg.Ctime() > o.SentBefore {
		return false
	}
	if o.SentBy != "" && msg.SenderUsername() != o.SentBy {
		return false
	}
	// Check if the user was @mentioned or there was a @here/@channel.
	if o.SentTo != "" {
		if o.MatchMentions {
			switch msg.ChannelMention() {
			case ChannelMention_ALL, ChannelMention_HERE:
				return true
			}
		}
		for _, username := range msg.AtMentionUsernames() {
			if o.SentTo == username {
				return true
			}
		}
		return false
	}
	return true
}

func (a MessageAttachment) GetTitle() string {
	title := a.Object.Title
	if title == "" {
		title = filepath.Base(a.Object.Filename)
	}
	return title
}

func (u MessageUnfurl) SearchableText() string {
	typ, err := u.Unfurl.Unfurl.UnfurlType()
	if err != nil {
		return ""
	}
	switch typ {
	case UnfurlType_GENERIC:
		generic := u.Unfurl.Unfurl.Generic()
		res := generic.Title
		if generic.Description != nil {
			res += " " + *generic.Description
		}
		return res
	}
	return ""
}

func (h *ChatSearchInboxHit) Size() int {
	if h == nil {
		return 0
	}
	return len(h.Hits)
}

func (u UnfurlRaw) GetUrl() string {
	typ, err := u.UnfurlType()
	if err != nil {
		return ""
	}
	switch typ {
	case UnfurlType_GENERIC:
		return u.Generic().Url
	case UnfurlType_GIPHY:
		if u.Giphy().ImageUrl != nil {
			return *u.Giphy().ImageUrl
		}
	}
	return ""
}

func (u UnfurlRaw) UnsafeDebugString() string {
	typ, err := u.UnfurlType()
	if err != nil {
		return "<error>"
	}
	switch typ {
	case UnfurlType_GENERIC:
		return u.Generic().UnsafeDebugString()
	case UnfurlType_GIPHY:
		return u.Giphy().UnsafeDebugString()
	}
	return "<unknown>"
}

func yieldStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func (g UnfurlGenericRaw) UnsafeDebugString() string {

	publishTime := ""
	if g.PublishTime != nil {
		publishTime = fmt.Sprintf("%v", time.Unix(int64(*g.PublishTime), 0))
	}
	return fmt.Sprintf(`Title: %s
Url: %s
SiteName: %s
PublishTime: %s
Description: %s
ImageUrl: %s
Video: %s
FaviconUrl: %s`, g.Title, g.Url, g.SiteName, publishTime, yieldStr(g.Description),
		yieldStr(g.ImageUrl), g.Video, yieldStr(g.FaviconUrl))
}

func (g UnfurlGiphyRaw) UnsafeDebugString() string {

	return fmt.Sprintf(`GIPHY SPECIAL
FaviconUrl: %s
ImageUrl: %s
Video: %s`, yieldStr(g.FaviconUrl), yieldStr(g.ImageUrl), g.Video)
}

func (v UnfurlVideo) String() string {
	return fmt.Sprintf("[url: %s width: %d height: %d mime: %s]", v.Url, v.Width, v.Height, v.MimeType)
}

func NewUnfurlSettings() UnfurlSettings {
	return UnfurlSettings{
		Mode:      UnfurlMode_WHITELISTED,
		Whitelist: make(map[string]bool),
	}
}

func GlobalAppNotificationSettingsSorted() (res []GlobalAppNotificationSetting) {
	for setting := range GlobalAppNotificationSettingRevMap {
		if setting.Usage() != "" && setting.FlagName() != "" {
			res = append(res, setting)
		}
	}
	sort.Slice(res, func(i, j int) bool {
		return res[i] < res[j]
	})
	return res
}

// Add to `Usage`/`FlagName` for a setting to be usable in the CLI via
// `keybase notification-settings`
func (g GlobalAppNotificationSetting) Usage() string {
	switch g {
	case GlobalAppNotificationSetting_NEWMESSAGES:
		return "Show notifications for new messages"
	case GlobalAppNotificationSetting_PLAINTEXTDESKTOP:
		return "Show plaintext notifications on desktop devices"
	case GlobalAppNotificationSetting_PLAINTEXTMOBILE:
		return "Show plaintext notifications on mobile devices"
	case GlobalAppNotificationSetting_DEFAULTSOUNDMOBILE:
		return "Use the default system sound on mobile devices"
	case GlobalAppNotificationSetting_DISABLETYPING:
		return "Disable sending/receiving typing notifications"
	default:
		return ""
	}
}

func (g GlobalAppNotificationSetting) FlagName() string {
	switch g {
	case GlobalAppNotificationSetting_NEWMESSAGES:
		return "new-messages"
	case GlobalAppNotificationSetting_PLAINTEXTDESKTOP:
		return "plaintext-desktop"
	case GlobalAppNotificationSetting_PLAINTEXTMOBILE:
		return "plaintext-mobile"
	case GlobalAppNotificationSetting_DEFAULTSOUNDMOBILE:
		return "default-sound-mobile"
	case GlobalAppNotificationSetting_DISABLETYPING:
		return "disable-typing"
	default:
		return ""
	}
}

func (m MessageSystemChangeRetention) String() string {
	var appliesTo string
	switch m.MembersType {
	case ConversationMembersType_TEAM:
		if m.IsTeam {
			appliesTo = "team"
		} else {
			appliesTo = "channel"
		}
	default:
		appliesTo = "conversation"
	}
	var inheritDescription string
	if m.IsInherit {
		inheritDescription = " to inherit from the team policy"
	}

	format := "%s changed the %s retention policy%s. %s"
	summary := m.Policy.HumanSummary()
	return fmt.Sprintf(format, m.User, appliesTo, inheritDescription, summary)
}

func (m MessageSystemBulkAddToConv) String() string {
	prefix := "Added %s to the conversation"
	var suffix string
	switch len(m.Usernames) {
	case 0:
		return ""
	case 1:
		suffix = m.Usernames[0]
	case 2:
		suffix = fmt.Sprintf("%s and %s", m.Usernames[0], m.Usernames[1])
	default:
		suffix = fmt.Sprintf("%s and %d others", m.Usernames[0], len(m.Usernames)-1)
	}
	return fmt.Sprintf(prefix, suffix)
}

func (m MessageSystem) String() string {
	typ, err := m.SystemType()
	if err != nil {
		return ""
	}
	switch typ {
	case MessageSystemType_ADDEDTOTEAM:
		output := fmt.Sprintf("Added @%s to the team", m.Addedtoteam().Addee)
		if role := m.Addedtoteam().Role; role != keybase1.TeamRole_NONE {
			output += fmt.Sprintf(" as a %q", role.HumanString())
		}
		return output
	case MessageSystemType_INVITEADDEDTOTEAM:
		var roleText string
		if role := m.Inviteaddedtoteam().Role; role != keybase1.TeamRole_NONE {
			roleText = fmt.Sprintf(" as a %q", role.HumanString())
		}
		output := fmt.Sprintf("Added %s to the team (invited by @%s%s)",
			m.Inviteaddedtoteam().Invitee, m.Inviteaddedtoteam().Inviter, roleText)
		return output
	case MessageSystemType_COMPLEXTEAM:
		return fmt.Sprintf("Created a new channel in %s", m.Complexteam().Team)
	case MessageSystemType_CREATETEAM:
		return fmt.Sprintf("%s created the team %s", m.Createteam().Creator, m.Createteam().Team)
	case MessageSystemType_GITPUSH:
		body := m.Gitpush()
		switch body.PushType {
		case keybase1.GitPushType_CREATEREPO:
			return fmt.Sprintf("git %s created the repo %s", body.Pusher, body.RepoName)
		case keybase1.GitPushType_RENAMEREPO:
			return fmt.Sprintf("git %s changed the name of the repo %s to %s", body.Pusher, body.PreviousRepoName, body.RepoName)
		default:
			total := keybase1.TotalNumberOfCommits(body.Refs)
			names := keybase1.RefNames(body.Refs)
			return fmt.Sprintf("git (%s) %s pushed %d commits to %s", body.RepoName,
				body.Pusher, total, names)
		}
	case MessageSystemType_CHANGEAVATAR:
		return fmt.Sprintf("%s changed team avatar", m.Changeavatar().User)
	case MessageSystemType_CHANGERETENTION:
		return m.Changeretention().String()
	case MessageSystemType_BULKADDTOCONV:
		return m.Bulkaddtoconv().String()
	case MessageSystemType_SBSRESOLVE:
		body := m.Sbsresolve()
		switch body.AssertionService {
		case "phone":
			return fmt.Sprintf("%s verified their phone number %s and joined"+
				" the conversation", body.Prover, body.AssertionUsername)
		case "email":
			return fmt.Sprintf("%s verified their email address %s and joined"+
				" the conversation", body.Prover, body.AssertionUsername)
		}
		return fmt.Sprintf("%s proved they are %s on %s and joined"+
			" the conversation", body.Prover, body.AssertionUsername,
			body.AssertionService)
	default:
		return ""
	}
}

func (m MessageHeadline) String() string {
	if m.Headline == "" {
		return "cleared the channel description"
	}
	return fmt.Sprintf("set the channel description: %v", m.Headline)
}

func isZero(v []byte) bool {
	for _, b := range v {
		if b != 0 {
			return false
		}
	}
	return true
}

func MakeFlipGameID(s string) (FlipGameID, error) { return hex.DecodeString(s) }
func (g FlipGameID) String() string               { return hex.EncodeToString(g) }
func (g FlipGameID) Eq(h FlipGameID) bool         { return hmac.Equal(g[:], h[:]) }
func (g FlipGameID) IsZero() bool                 { return isZero(g[:]) }
func (g FlipGameID) Check() bool                  { return g != nil && !g.IsZero() }

func (o *SenderSendOptions) GetJoinMentionsAs() *ConversationMemberStatus {
	if o == nil {
		return nil
	}
	return o.JoinMentionsAs
}

func (c Coordinate) IsZero() bool {
	return c.Lat == 0 && c.Lon == 0
}

func (c Coordinate) Eq(o Coordinate) bool {
	return c.Lat == o.Lat && c.Lon == o.Lon
}

// Incremented if the client hash algorithm changes. If this value is changed
// be sure to add a case in the BotInfo.Hash() function.
const ClientBotInfoHashVers BotInfoHashVers = 1

// Incremented if the server sends down bad data and needs to bust client
// caches.
const ServerBotInfoHashVers BotInfoHashVers = 1

func (b BotInfo) Hash() BotInfoHash {
	hash := sha256Pool.Get().(hash.Hash)
	defer sha256Pool.Put(hash)
	hash.Reset()

	// Always hash in the server/client version.
	hash.Write([]byte(strconv.FormatUint(uint64(b.ServerHashVers), 10)))
	hash.Write([]byte(strconv.FormatUint(uint64(b.ClientHashVers), 10)))

	// This should cover all cases from 0..DefaultBotInfoHashVers. If
	// incrementing DefaultBotInfoHashVers be sure to add a case here.
	switch b.ClientHashVers {
	case 0, 1:
		b.hashV1(hash)
	default:
		// Every valid client version should be specifically handled, unit
		// tests verify that we have a non-empty hash output.
		hash.Reset()
	}
	return BotInfoHash(hash.Sum(nil))
}

func (b BotInfo) hashV1(hash hash.Hash) {
	sort.Slice(b.CommandConvs, func(i, j int) bool {
		ikey := b.CommandConvs[i].Uid.String() + b.CommandConvs[i].ConvID.String()
		jkey := b.CommandConvs[j].Uid.String() + b.CommandConvs[j].ConvID.String()
		return ikey < jkey
	})
	for _, cconv := range b.CommandConvs {
		hash.Write(cconv.ConvID)
		hash.Write(cconv.Uid)
		hash.Write([]byte(strconv.FormatUint(uint64(cconv.UntrustedTeamRole), 10)))
		hash.Write([]byte(strconv.FormatUint(uint64(cconv.Vers), 10)))
	}
}

func (b BotInfoHash) Eq(h BotInfoHash) bool {
	return bytes.Equal(b, h)
}

func (p AdvertiseCommandsParam) ToRemote(convID ConversationID, tlfID *TLFID) (res RemoteBotCommandsAdvertisement, err error) {
	switch p.Typ {
	case BotCommandsAdvertisementTyp_PUBLIC:
		return NewRemoteBotCommandsAdvertisementWithPublic(RemoteBotCommandsAdvertisementPublic{
			ConvID: convID,
		}), nil
	case BotCommandsAdvertisementTyp_TLFID_CONVS:
		if tlfID == nil {
			return res, errors.New("no TLFID specified")
		}
		return NewRemoteBotCommandsAdvertisementWithTlfidConvs(RemoteBotCommandsAdvertisementTLFID{
			ConvID: convID,
			TlfID:  *tlfID,
		}), nil
	case BotCommandsAdvertisementTyp_TLFID_MEMBERS:
		if tlfID == nil {
			return res, errors.New("no TLFID specified")
		}
		return NewRemoteBotCommandsAdvertisementWithTlfidMembers(RemoteBotCommandsAdvertisementTLFID{
			ConvID: convID,
			TlfID:  *tlfID,
		}), nil
	default:
		return res, errors.New("unknown bot advertisement typ")
	}
}

func (c UserBotCommandInput) ToOutput(username string) UserBotCommandOutput {
	return UserBotCommandOutput{
		Name:                c.Name,
		Description:         c.Description,
		Usage:               c.Usage,
		ExtendedDescription: c.ExtendedDescription,
		Username:            username,
	}
}

func (r UIInboxReselectInfo) String() string {
	newConvStr := "<none>"
	if r.NewConvID != nil {
		newConvStr = *r.NewConvID
	}
	return fmt.Sprintf("[oldconv: %s newconv: %s]", r.OldConvID, newConvStr)
}

func (e OutboxErrorType) IsBadgableError() bool {
	switch e {
	case OutboxErrorType_MISC,
		OutboxErrorType_OFFLINE,
		OutboxErrorType_TOOLONG,
		OutboxErrorType_EXPIRED,
		OutboxErrorType_TOOMANYATTEMPTS,
		OutboxErrorType_UPLOADFAILED:
		return true
	default:
		return false
	}
}

func (c UserBotCommandOutput) Matches(text string) bool {
	return strings.HasPrefix(text, fmt.Sprintf("!%s ", c.Name))
}

func (m AssetMetadata) IsType(typ AssetMetadataType) bool {
	mtyp, err := m.AssetType()
	if err != nil {
		return false
	}
	return mtyp == typ
}

func (s SnippetDecoration) ToEmoji() string {
	switch s {
	case SnippetDecoration_PENDING_MESSAGE:
		return "📤"
	case SnippetDecoration_FAILED_PENDING_MESSAGE:
		return "⚠️"
	case SnippetDecoration_EXPLODING_MESSAGE:
		return "💣"
	case SnippetDecoration_EXPLODED_MESSAGE:
		return "💥"
	case SnippetDecoration_AUDIO_ATTACHMENT:
		return "🔊"
	case SnippetDecoration_VIDEO_ATTACHMENT:
		return "🎞"
	case SnippetDecoration_PHOTO_ATTACHMENT:
		return "📷"
	case SnippetDecoration_FILE_ATTACHMENT:
		return "📁"
	case SnippetDecoration_STELLAR_RECEIVED:
		return "💰"
	case SnippetDecoration_STELLAR_SENT:
		return "🚀"
	case SnippetDecoration_PINNED_MESSAGE:
		return "📌"
	default:
		return ""
	}
}
