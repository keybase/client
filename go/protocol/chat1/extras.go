package chat1

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"flag"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

// we will show some representation of an exploded message in the UI for a week
const explosionLifetime = time.Hour * 24 * 7

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

func (m MessageUnboxed) GetMessageID() MessageID {
	if state, err := m.State(); err == nil {
		if state == MessageUnboxedState_VALID {
			return m.Valid().ServerHeader.MessageID
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

func (m MessageUnboxed) GetMessageType() MessageType {
	if state, err := m.State(); err == nil {
		if state == MessageUnboxedState_VALID {
			return m.Valid().ClientHeader.MessageType
		}
		if state == MessageUnboxedState_ERROR {
			return m.Error().MessageType
		}
		if state == MessageUnboxedState_OUTBOX {
			return m.Outbox().Msg.ClientHeader.MessageType
		}
		if state == MessageUnboxedState_PLACEHOLDER {
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
		return fmt.Sprintf("[%v %v mt:%v (%v)]", state, m.GetMessageID(), merr.ErrType, merr.ErrMsg)
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

func (m MessagePlaintext) IsExploding() bool {
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

func (m MessageUnboxedValid) IsExploding() bool {
	return m.EphemeralMetadata() != nil
}

func (m MessageUnboxedValid) EphemeralMetadata() *MsgEphemeralMetadata {
	return m.ClientHeader.EphemeralMetadata
}

func Etime(lifetime gregor1.DurationSec, ctime, rtime, now gregor1.Time) gregor1.Time {
	originalLifetime := time.Second * time.Duration(lifetime)
	elapsedLifetime := ctime.Time().Sub(now.Time())
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
	header := m.ServerHeader
	return Etime(metadata.Lifetime, header.Ctime, m.ClientHeader.Rtime, header.Now)
}

func (m MessageUnboxedValid) RemainingLifetime() time.Duration {
	remainingLifetime := m.Etime().Time().Sub(time.Now()).Round(time.Second)
	return remainingLifetime
}

func (m MessageUnboxedValid) IsEphemeralExpired(now time.Time) bool {
	if !m.IsExploding() {
		return false
	}
	etime := m.Etime().Time()
	return etime.Before(now) || etime.Equal(now)
}

func (m MessageUnboxedValid) HideExplosion(now time.Time) bool {
	if !m.IsExploding() {
		return false
	}
	etime := m.Etime()
	return etime.Time().Add(explosionLifetime).Before(now)
}

func (m MessageUnboxedError) IsExploding() bool {
	return m.EphemeralMetadata != nil
}

func (m MessageUnboxedError) Etime() gregor1.Time {
	// The server sends us (untrusted) ctime of the message and server's view
	// of now. We use these to calculate the remaining lifetime on an ephemeral
	// message, returning an etime based on our received time.
	metadata := m.EphemeralMetadata
	return Etime(metadata.Lifetime, m.Ctime, m.Rtime, m.Now)
}

func (m MessageUnboxedError) IsEphemeralExpired(now time.Time) bool {
	if !m.IsExploding() {
		return false
	}
	etime := m.Etime().Time()
	return etime.Before(now) || etime.Equal(now)
}

func (m MessageUnboxedError) HideExplosion(now time.Time) bool {
	if !m.IsExploding() {
		return false
	}
	etime := m.Etime()
	return etime.Time().Add(explosionLifetime).Before(now)
}

func (m UIMessageValid) IsExploding() bool {
	return m.EphemeralMetadata != nil
}

func (b MessageBody) IsNil() bool {
	return b == MessageBody{}
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

func (m MessageBoxed) KBFSEncrypted() bool {
	return m.ClientHeader.KbfsCryptKeysUsed == nil || *m.ClientHeader.KbfsCryptKeysUsed
}

func (m MessageBoxed) EphemeralMetadata() *MsgEphemeralMetadata {
	return m.ClientHeader.EphemeralMetadata
}

func (m MessageBoxed) IsExploding() bool {
	return m.EphemeralMetadata() != nil
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

func (t ConversationIDTriple) Hash() []byte {
	h := sha256.New()
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

func (p Pagination) Eq(other Pagination) bool {
	return p.Last == other.Last && bytes.Equal(p.Next, other.Next) &&
		bytes.Equal(p.Previous, other.Previous) && p.Num == other.Num
}

func (p Pagination) String() string {
	return fmt.Sprintf("[Num: %d n: %s p: %s last: %v]", p.Num, hex.EncodeToString(p.Next),
		hex.EncodeToString(p.Previous), p.Last)
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

func (r *DownloadAttachmentLocalRes) SetOffline() {
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
