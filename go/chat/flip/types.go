package flip

import (
	"crypto/hmac"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"
)

func (g GameID) String() string                   { return hex.EncodeToString(g) }
func (u UID) String() string                      { return hex.EncodeToString(u) }
func (d DeviceID) String() string                 { return hex.EncodeToString(d) }
func (c ConversationID) String() string           { return hex.EncodeToString(c) }
func (g GameID) Eq(h GameID) bool                 { return hmac.Equal(g[:], h[:]) }
func (u UID) Eq(v UID) bool                       { return hmac.Equal(u[:], v[:]) }
func (d DeviceID) Eq(e DeviceID) bool             { return hmac.Equal(d[:], e[:]) }
func (u UserDevice) Eq(v UserDevice) bool         { return u.U.Eq(v.U) && u.D.Eq(v.D) }
func (c ConversationID) Eq(d ConversationID) bool { return hmac.Equal(c[:], d[:]) }

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
