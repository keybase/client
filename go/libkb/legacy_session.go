package libkb

import (
	"github.com/keybase/client/go/protocol/keybase1"
	"time"
)

type SessionReader interface {
	APIArgs() (token, csrf string)
	IsLoggedIn() bool
	Invalidate()
}

type LegacySession struct {
	uid     keybase1.UID
	token   string
	csrf    string
	created time.Time
}

func (l *LegacySession) clear() {
	l.uid = keybase1.UID("")
	l.token = ""
	l.csrf = ""
	l.created = time.Time{}
}
