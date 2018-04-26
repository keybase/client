package libkb

import (
	"github.com/keybase/client/go/protocol/keybase1"
	"time"
)

type LegacySession struct {
	token   string
	csrf    string
	created time.Time
}


func (l *LegacySession) clear() {
	l.token = ""
	l.csrf = ""
	l.created = time.Time{}
}

func (l *LegacySession) set(g *GlobalContext, token string, csrf string, ) {
	l.token = token
	l.csrf = csrf
	l.created = g.Clock().Now()
}

func (l LegacySession) valid() bool {
	return l.token != ""
}

func (l LegacySession) APIArgs() (string, string) {
	return l.token, l.csrf
}

func (l LegacySession) IsLoggedIn() bool {
	return l.token != ""
}
