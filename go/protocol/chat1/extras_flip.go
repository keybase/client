package chat1

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"
)

func (g GameID) String() string                   { return hex.EncodeToString(g) }
func (u UID) String() string                      { return hex.EncodeToString(u) }
func (d DeviceID) String() string                 { return hex.EncodeToString(d) }
func (g GameID) Eq(h GameID) bool                 { return hmac.Equal(g[:], h[:]) }
func (u UID) Eq(v UID) bool                       { return hmac.Equal(u[:], v[:]) }
func (d DeviceID) Eq(e DeviceID) bool             { return hmac.Equal(d[:], e[:]) }
func (u UserDevice) Eq(v UserDevice) bool         { return u.U.Eq(v.U) && u.D.Eq(v.D) }

func (t Time) Time() time.Time {
	if t == 0 {
		return time.Time{}
	}
	return time.Unix(0, int64(t)*1000000)
}

func (t Time) Duration() time.Duration {
	return time.Duration(t) * time.Millisecond
}

func ToTime(t time.Time) Time {
	if t.IsZero() {
		return 0
	}
	return Time(t.UnixNano() / 1000000)
}

func GenerateGameID() GameID {
	l := 12
	ret := make([]byte, l)
	n, err := rand.Read(ret[:])
	if n != l {
		panic("short random read")
	}
	if err != nil {
		panic(fmt.Sprintf("error reading randomness: %s", err.Error()))
	}
	return GameID(ret)
}

func (s Start) CommitmentWindowWithSlack() time.Duration {
	return Time(s.CommitmentWindowMsec + s.SlackMsec).Duration()
}

func (s Start) RevealWindowWithSlack() time.Duration {
	return Time(s.CommitmentWindowMsec + s.RevealWindowMsec + 2*s.SlackMsec).Duration()
}

func (c ConversationID) check() bool { return c != nil }
func (u UID) check() bool            { return u != nil }
func (d DeviceID) check() bool       { return d != nil }
func (g GameID) check() bool         { return g != nil }

func (g GameMetadata) ToKey() GameKey {
	return GameKey(strings.Join([]string{g.Initiator.U.String(), g.Initiator.D.String(), g.ConversationID.String(), g.GameID.String()}, ","))
}
func (g GameMetadata) String() string {
	return string(g.ToKey())
}
func (g GameMetadata) check() bool {
	return g.Initiator.check() && g.ConversationID.check() && g.GameID.check()
}
func (u UserDevice) ToKey() UserDeviceKey {
	return UserDeviceKey(strings.Join([]string{u.U.String(), u.D.String()}, ","))
}

func (u UserDevice) check() bool {
	return u.U.check() && u.D.check()
}

func (g GameID) ToKey() GameIDKey {
	return GameIDKey(g.String())
}

func (s *Secret) XOR(t Secret) *Secret {
	for i, b := range t {
		s[i] = b ^ s[i]
	}
	return s
}

func (s Secret) IsNil() bool {
	return bytesAreNil(s[:])
}

func bytesAreNil(v []byte) bool {
	for _, b := range v[:] {
		if b != byte(0) {
			return false
		}
	}
	return true
}

func (s Secret) Hash() Secret {
	h := sha256.New()
	h.Write(s[:])
	tmp := h.Sum(nil)
	var ret Secret
	copy(ret[:], tmp[:])
	return ret
}

func (s Secret) Eq(t Secret) bool {
	return hmac.Equal(s[:], t[:])
}

func (c Commitment) Eq(d Commitment) bool {
	return hmac.Equal(c[:], d[:])
}

func GenerateSecret() Secret {
	var ret Secret
	n, err := rand.Read(ret[:])
	if n != len(ret) {
		panic("failed to generate secret; short random read")
	}
	if err != nil {
		panic(fmt.Sprintf("failed to generated secret: %s", err.Error()))
	}
	return ret
}
