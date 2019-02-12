package flip

import (
	"crypto/hmac"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	gregor1 "github.com/keybase/client/go/protocol/gregor1"
)

func (g GameID) String() string           { return hex.EncodeToString(g) }
func (g GameID) Eq(h GameID) bool         { return hmac.Equal(g[:], h[:]) }
func (u UserDevice) Eq(v UserDevice) bool { return u.U.Eq(v.U) && u.D.Eq(v.D) }

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
	return gregor1.DurationMsec(s.CommitmentWindowMsec + s.SlackMsec).ToDuration()
}

func (s Start) RevealWindowWithSlack() time.Duration {
	return gregor1.DurationMsec(s.CommitmentWindowMsec + s.RevealWindowMsec + 2*s.SlackMsec).ToDuration()
}

func isZero(v []byte) bool {
	for _, b := range v {
		if b != 0 {
			return false
		}
	}
	return true
}

func (g GameID) IsZero() bool { return isZero(g[:]) }
func (g GameID) check() bool  { return g != nil && !g.IsZero() }
