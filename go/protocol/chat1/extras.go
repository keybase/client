package chat1

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
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

func MakeConvID(val string) (ConversationID, error) {
	return hex.DecodeString(val)
}

func (cid ConversationID) Bytes() []byte {
	return []byte(cid)
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

func (me ConversationIDTriple) Eq(other ConversationIDTriple) bool {
	return me.Tlfid.Eq(other.Tlfid) &&
		bytes.Equal([]byte(me.TopicID), []byte(other.TopicID)) &&
		me.TopicType == other.TopicType
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

var ConversationStatusGregorMap = map[ConversationStatus]string{
	ConversationStatus_UNFILED:  "unfiled",
	ConversationStatus_FAVORITE: "favorite",
	ConversationStatus_IGNORED:  "ignored",
	ConversationStatus_BLOCKED:  "blocked",
}

var ConversationStatusGregorRevMap = map[string]ConversationStatus{
	"unfiled":  ConversationStatus_UNFILED,
	"favorite": ConversationStatus_FAVORITE,
	"ignored":  ConversationStatus_IGNORED,
	"blocked":  ConversationStatus_BLOCKED,
}

func (t ConversationIDTriple) Hash10B() []byte {
	h := sha256.New()
	h.Write(t.Tlfid)
	h.Write(t.TopicID)
	h.Write([]byte(strconv.Itoa(int(t.TopicType))))
	hash := h.Sum(nil)

	return hash[:10]
}

func (t ConversationIDTriple) ToConversationID(shardID [2]byte) ConversationID {
	h := t.Hash10B()
	h[0], h[1] = shardID[0], shardID[1]
	return ConversationID(h)
}

func (t ConversationIDTriple) Derivable(cid ConversationID) bool {
	if len(cid) != 10 {
		return false
	}
	h10 := t.Hash10B()
	return bytes.Equal(h10[2:], []byte(cid[2:]))
}

func (o OutboxID) Eq(r OutboxID) bool {
	return bytes.Equal(o, r)
}
