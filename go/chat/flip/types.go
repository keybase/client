package flip

import (
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math/big"
	"time"

	chat1 "github.com/keybase/client/go/protocol/chat1"
)

func (u UserDevice) Eq(v UserDevice) bool { return u.U.Eq(v.U) && u.D.Eq(v.D) }
func (h Hash) Eq(i Hash) bool             { return hmac.Equal(h[:], i[:]) }
func (c Commitment) String() string       { return hex.EncodeToString(c[:]) }
func (s Secret) String() string           { return hex.EncodeToString(s[:]) }

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

func GenerateGameID() chat1.FlipGameID {
	l := 12
	ret := make([]byte, l)
	n, err := rand.Read(ret[:])
	if n != l {
		panic("short random read")
	}
	if err != nil {
		panic(fmt.Sprintf("error reading randomness: %s", err.Error()))
	}
	return chat1.FlipGameID(ret)
}

func (s Start) CommitmentWindowWithSlack(isLeader bool) time.Duration {
	window := s.CommitmentCompleteWindowMsec
	if isLeader {
		window = s.CommitmentWindowMsec
	}
	return Time(window + s.SlackMsec).Duration()
}

func (s Start) RevealWindowWithSlack() time.Duration {
	return Time(s.CommitmentWindowMsec + s.RevealWindowMsec + 2*s.SlackMsec).Duration()
}

func (u UserDevice) LessThan(v UserDevice) bool {
	cu := bytes.Compare([]byte(u.U), []byte(v.U))
	du := bytes.Compare([]byte(u.D), []byte(v.D))
	return cu < 0 || (cu == 0 && du < 0)
}

func (h Hash) String() string {
	return hex.EncodeToString(h[:])
}

func (m GameMessageBody) String() string {
	t, err := m.T()
	if err != nil {
		return fmt.Sprintf("union error: %s", err.Error())
	}
	switch t {
	case MessageType_START:
		return fmt.Sprintf("START: %+v", m.Start())
	case MessageType_COMMITMENT:
		return fmt.Sprintf("COMMITMENT: %+v", m.Commitment())
	case MessageType_COMMITMENT_COMPLETE:
		return fmt.Sprintf("COMMITMENT COMPLETE: %+v", m.CommitmentComplete())
	case MessageType_REVEAL:
		return "REVEAL"
	case MessageType_END:
		return "END"
	default:
		return fmt.Sprintf("Unknown: %d", t)
	}
}

func (p FlipParameters) String() string {
	t, err := p.T()
	if err != nil {
		return fmt.Sprintf("union error: %s", err.Error())
	}
	switch t {
	case FlipType_BOOL:
		return "bool"
	case FlipType_INT:
		return fmt.Sprintf("int(%d)", p.Int())
	case FlipType_BIG:
		var n big.Int
		n.SetBytes(p.Big())
		return fmt.Sprintf("big(%s)", n.String())
	case FlipType_SHUFFLE:
		return fmt.Sprintf("shuffle(%d)", p.Shuffle())
	default:
		return fmt.Sprintf("Unknown: %d", t)
	}
}
