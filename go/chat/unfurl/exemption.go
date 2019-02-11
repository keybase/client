package unfurl

import (
	"sync"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/protocol/chat1"
)

type OneTimeWhitelistExemption struct {
	sync.Mutex
	used   bool
	convID chat1.ConversationID
	msgID  chat1.MessageID
	domain string
}

var _ (types.WhitelistExemption) = (*OneTimeWhitelistExemption)(nil)

func NewOneTimeWhitelistExemption(convID chat1.ConversationID, msgID chat1.MessageID, domain string) *OneTimeWhitelistExemption {
	return &OneTimeWhitelistExemption{
		convID: convID,
		msgID:  msgID,
		domain: domain,
	}
}

func (o *OneTimeWhitelistExemption) Use() bool {
	o.Lock()
	defer o.Unlock()
	res := !o.used
	o.used = true
	return res
}

func (o *OneTimeWhitelistExemption) Matches(convID chat1.ConversationID, msgID chat1.MessageID,
	domain string) bool {
	return o.convID.Eq(convID) && o.msgID == msgID && o.domain == domain
}

func (o *OneTimeWhitelistExemption) Domain() string {
	o.Lock()
	defer o.Unlock()
	return o.domain
}

type SingleMessageWhitelistExemption struct {
	sync.Mutex
	convID chat1.ConversationID
	msgID  chat1.MessageID
	domain string
}

var _ (types.WhitelistExemption) = (*SingleMessageWhitelistExemption)(nil)

func NewSingleMessageWhitelistExemption(convID chat1.ConversationID, msgID chat1.MessageID, domain string) *SingleMessageWhitelistExemption {
	return &SingleMessageWhitelistExemption{
		convID: convID,
		msgID:  msgID,
		domain: domain,
	}
}

func (o *SingleMessageWhitelistExemption) Use() bool {
	o.Lock()
	defer o.Unlock()
	return true
}

func (o *SingleMessageWhitelistExemption) Matches(convID chat1.ConversationID, msgID chat1.MessageID,
	domain string) bool {
	return o.convID.Eq(convID) && o.msgID == msgID && o.domain == domain
}

func (o *SingleMessageWhitelistExemption) Domain() string {
	o.Lock()
	defer o.Unlock()
	return o.domain
}

type WhitelistExemptionList struct {
	sync.Mutex
	exemptions []types.WhitelistExemption
}

func NewWhitelistExemptionList() *WhitelistExemptionList {
	return &WhitelistExemptionList{}
}

func (l *WhitelistExemptionList) Add(e types.WhitelistExemption) {
	l.Lock()
	defer l.Unlock()
	l.exemptions = append(l.exemptions, e)
}

func (l *WhitelistExemptionList) Use(convID chat1.ConversationID, msgID chat1.MessageID, domain string) bool {
	l.Lock()
	defer l.Unlock()
	var nextlist []types.WhitelistExemption
	exempted := false
	for _, e := range l.exemptions {
		if exempted || !e.Matches(convID, msgID, domain) {
			nextlist = append(nextlist, e)
			continue
		}
		if e.Use() {
			exempted = true
			nextlist = append(nextlist, e)
		}
	}
	l.exemptions = nextlist
	return exempted
}
