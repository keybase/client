package chat1

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"flag"
	"fmt"
	"strconv"
	"strings"

	"github.com/keybase/client/go/protocol/gregor1"
)

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

func MakeConvID(val string) (ConversationID, error) {
	return hex.DecodeString(val)
}

func (cid ConversationID) String() string {
	return hex.EncodeToString(cid)
}

func (cid ConversationID) IsNil() bool {
	return len(cid) == 0
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
func (cid ConversationID) DbShortForm() []byte {
	return cid[:DbShortFormLen]
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

func (t MessageType) String() string {
	switch t {
	case MessageType_NONE:
		return "NONE"
	case MessageType_TEXT:
		return "TEXT"
	case MessageType_ATTACHMENT:
		return "ATTACHMENT"
	case MessageType_EDIT:
		return "EDIT"
	case MessageType_DELETE:
		return "DELETE"
	case MessageType_METADATA:
		return "METADATA"
	case MessageType_TLFNAME:
		return "TLFNAME"
	case MessageType_ATTACHMENTUPLOADED:
		return "ATTACHMENTUPLOADED"
	default:
		return "UNKNOWN"
	}
}

func (t TopicType) String() string {
	switch t {
	case TopicType_NONE:
		return "NONE"
	case TopicType_CHAT:
		return "CHAT"
	case TopicType_DEV:
		return "DEV"
	default:
		return "UNKNOWN"
	}
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

func (m MessageBoxed) GetMessageID() MessageID {
	return m.ServerHeader.MessageID
}

func (m MessageBoxed) GetMessageType() MessageType {
	return m.ClientHeader.MessageType
}

func (m MessageBoxed) Summary() MessageSummary {
	return MessageSummary{
		MsgID:       m.GetMessageID(),
		MessageType: m.GetMessageType(),
		TlfName:     m.ClientHeader.TlfName,
		TlfPublic:   m.ClientHeader.TlfPublic,
	}
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

func (t TLFVisibility) Eq(r TLFVisibility) bool {
	return int(t) == int(r)
}

// Visibility is a helper to get around a nil pointer for visibility,
// and to get around TLFVisibility_ANY.  The default is PRIVATE.
// Note:  not sure why visibility is a pointer, or what TLFVisibility_ANY
// is for, but don't want to change the API.
func (q *GetInboxLocalQuery) Visibility() TLFVisibility {
	visibility := TLFVisibility_PRIVATE
	if q.TlfVisibility != nil && *q.TlfVisibility == TLFVisibility_PUBLIC {
		visibility = TLFVisibility_PUBLIC
	}
	return visibility
}

// Visibility is a helper to get around a nil pointer for visibility,
// and to get around TLFVisibility_ANY.  The default is PRIVATE.
// Note:  not sure why visibility is a pointer, or what TLFVisibility_ANY
// is for, but don't want to change the API.
func (q *GetInboxQuery) Visibility() TLFVisibility {
	visibility := TLFVisibility_PRIVATE
	if q.TlfVisibility != nil && *q.TlfVisibility == TLFVisibility_PUBLIC {
		visibility = TLFVisibility_PUBLIC
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
// This version is for display purposes only and connot be used to lookup the TLF.
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

func (c ConversationLocal) GetMaxMessage(typ MessageType) (MessageUnboxed, error) {
	for _, msg := range c.MaxMessages {
		if msg.GetMessageType() == typ {
			return msg, nil
		}
	}
	return MessageUnboxed{}, fmt.Errorf("max message not found: %v", typ)
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

func (t TyperInfo) String() string {
	return fmt.Sprintf("typer(u:%s d:%s)", t.Username, t.DeviceName)
}

func (o TLFConvOrdinal) Int() int {
	return int(o)
}

func (o TLFConvOrdinal) IsFirst() bool {
	return o.Int() == 1
}
