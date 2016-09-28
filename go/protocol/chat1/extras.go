package chat1

import (
	"bytes"
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

func (cid ConversationID) String() string {
	return strconv.FormatUint(uint64(cid), 10)
}

func MakeConversationID(val uint64) ConversationID {
	return ConversationID(val)
}

func ConvertConversationID(val string) (ConversationID, error) {
	raw, err := strconv.ParseUint(val, 10, 64)
	if err != nil {
		return 0, err
	}
	return MakeConversationID(raw), nil
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
