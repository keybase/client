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

func (cid ConversationID) String() string {
	return strconv.FormatUint(uint64(cid), 10)
}
