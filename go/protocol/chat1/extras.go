package chat1

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
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

func MakeConvID(val string) (ConversationID, error) {
	return hex.DecodeString(val)
}

func (cid ConversationID) String() string {
	return hex.EncodeToString(cid)
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
	return cid[:DbShortFormLen]
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

func VisibleChatMessageTypes() []MessageType {
	return []MessageType{
		MessageType_TEXT,
		MessageType_ATTACHMENT,
		MessageType_SYSTEM,
		MessageType_SENDPAYMENT,
		MessageType_REQUESTPAYMENT,
	}
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

func (m MessageUnboxed) SearchableText() string {
	if !m.IsValidFull() {
		return ""
	}
	return m.Valid().MessageBody.SearchableText()
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
var MaxBodyVersion BodyPlaintextVersion = BodyPlaintextVersion_V1

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
	return fmt.Sprintf("{ Lifetime: %v, Generation: %v, ExplodedBy: %v }", time.Second*time.Duration(m.Lifetime), m.Generation, explodedBy)
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
	originalLifetime := time.Second * time.Duration(lifetime)
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
	if state, err := m.State(); err == nil {
		if state == MessageUnboxedState_VALID {
			body := m.Valid().MessageBody
			typ, err := body.MessageType()
			if err != nil {
				return MessageType_NONE
			}
			return typ
		}
		if state == MessageUnboxedState_ERROR {
			return m.Error().MessageType
		}
		if state == MessageUnboxedState_OUTBOX {
			return m.Outbox().MessageType
		}
		if state == MessageUnboxedState_PLACEHOLDER {
			// All we know about a place holder is the ID, so just
			// call it type NONE
			return MessageType_NONE
		}
	}
	return MessageType_NONE
}

func (m UIMessage) SearchableText() string {
	if !m.IsValid() {
		return ""
	}
	return m.Valid().MessageBody.SearchableText()
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

func (o OutboxRecord) IsAttachment() bool {
	return o.Msg.ClientHeader.MessageType == MessageType_ATTACHMENT
}

func (o OutboxRecord) IsUnfurl() bool {
	return o.Msg.ClientHeader.MessageType == MessageType_UNFURL
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
	return p == nil || (len(p.Next) == 0 && len(p.Previous) == 0)
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

func (c ConversationLocal) GetFinalizeInfo() *ConversationFinalizeInfo {
	return c.Info.FinalizeInfo
}

func (c ConversationLocal) GetExpunge() *Expunge {
	return &c.Expunge
}

func (c ConversationLocal) IsPublic() bool {
	return c.Info.Visibility == keybase1.TLFVisibility_PUBLIC
}

func (c ConversationLocal) GetMaxMessage(typ MessageType) (MessageUnboxed, error) {
	for _, msg := range c.MaxMessages {
		if msg.GetMessageType() == typ {
			return msg, nil
		}
	}
	return MessageUnboxed{}, fmt.Errorf("max message not found: %v", typ)
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

func (c ConversationLocal) Names() (res []string) {
	for _, p := range c.Info.Participants {
		res = append(res, p.Username)
	}
	return res
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

func (c Conversation) GetFinalizeInfo() *ConversationFinalizeInfo {
	return c.Metadata.FinalizeInfo
}

func (c Conversation) GetExpunge() *Expunge {
	return &c.Expunge
}

func (c Conversation) IsPublic() bool {
	return c.Metadata.Visibility == keybase1.TLFVisibility_PUBLIC
}

func (c Conversation) GetMaxMessage(typ MessageType) (MessageSummary, error) {
	for _, msg := range c.MaxMsgSummaries {
		if msg.GetMessageType() == typ {
			return msg, nil
		}
	}
	return MessageSummary{}, fmt.Errorf("max message not found: %v", typ)
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

func (r *DownloadAttachmentLocalRes) SetOffline() {
	r.Offline = true
}

func (r *DownloadFileAttachmentLocalRes) SetOffline() {
	r.Offline = true
}

func (r *FindConversationsLocalRes) SetOffline() {
	r.Offline = true
}

func (r *JoinLeaveConversationLocalRes) SetOffline() {
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

func AllConversationMemberStatuses() (res []ConversationMemberStatus) {
	for status := range ConversationMemberStatusRevMap {
		res = append(res, status)
	}
	return res
}

func AllConversationExistences() (res []ConversationExistence) {
	for existence := range ConversationExistenceRevMap {
		res = append(res, existence)
	}
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

func (p RetentionPolicy) Summary() string {
	typ, err := p.Typ()
	if err != nil {
		return "{variant error}"
	}
	switch typ {
	case RetentionPolicyType_EXPIRE:
		return fmt.Sprintf("{%v age:%v}", typ, p.Expire().Age)
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

func (i EphemeralPurgeInfo) String() string {
	return fmt.Sprintf("EphemeralPurgeInfo{ ConvID: %v, IsActive: %v, NextPurgeTime: %v, MinUnexplodedID: %v }",
		i.ConvID, i.IsActive, i.NextPurgeTime.Time(), i.MinUnexplodedID)
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
	usernameSuffix := "."
	if i.Username != "" {
		usernameSuffix = fmt.Sprintf(", last set by %v.", i.Username)
	}
	return fmt.Sprintf("Minimum writer role for this conversation is %v%v", i.Role, usernameSuffix)
}

func (s *ConversationSettings) IsNil() bool {
	return s == nil || s.MinWriterRoleInfo == nil
}

type MsgMetadata interface {
	GetSenderUsername() string
	GetCtime() gregor1.Time
}

func (m MessageUnboxed) GetSenderUsername() string {
	if !m.IsValid() {
		return ""
	}
	return m.Valid().SenderUsername
}

func (m MessageUnboxed) GetCtime() gregor1.Time {
	if !m.IsValid() {
		return 0
	}
	return m.Valid().ServerHeader.Ctime
}

func (o SearchOpts) Matches(msgMetadata MsgMetadata) bool {
	if o.SentBy != "" && msgMetadata.GetSenderUsername() != o.SentBy {
		return false
	}
	if o.SentAfter != 0 && msgMetadata.GetCtime() < o.SentAfter {
		return false
	}
	if o.SentBefore != 0 && msgMetadata.GetCtime() > o.SentBefore {
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

func (h *ChatSearchInboxHit) Size() int {
	if h == nil {
		return 0
	}
	return len(h.Hits)
}

func (idx *ConversationIndex) MissingIDs(min, max MessageID) []MessageID {
	missingIDs := []MessageID{}
	if min == 0 {
		min = 1
	}
	for i := min; i <= max; i++ {
		if _, ok := idx.Metadata.SeenIDs[i]; !ok {
			missingIDs = append(missingIDs, i)
		}
	}
	return missingIDs
}

func (idx *ConversationIndex) PercentIndexed(conv Conversation) int {
	if idx == nil {
		return 0
	}
	// lowest msgID we care about
	min := conv.GetMaxDeletedUpTo()
	// highest msgID we care about
	max := conv.GetMaxMessageID()
	numMessages := int(max) - int(min)
	if numMessages <= 0 {
		return 100
	}
	missingIDs := idx.MissingIDs(min, max)
	return 100 * (1 - (len(missingIDs) / numMessages))
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
		return u.Giphy().ImageUrl
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
Video: %s`, yieldStr(g.FaviconUrl), g.ImageUrl, g.Video)
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
