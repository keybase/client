package unfurl

import (
	"sync"

	"github.com/keybase/client/go/chat/types"
)

type OneTimeWhitelistExemption struct {
	sync.Mutex
	used   bool
	domain string
}

var _ (types.WhitelistExemption) = (*OneTimeWhitelistExemption)(nil)

func NewOneTimeWhitelistExemption(domain string) *OneTimeWhitelistExemption {
	return &OneTimeWhitelistExemption{
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

func (o *OneTimeWhitelistExemption) Domain() string {
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

func (l *WhitelistExemptionList) Use(domain string) bool {
	l.Lock()
	defer l.Unlock()
	var nextlist []types.WhitelistExemption
	exempted := false
	for _, e := range l.exemptions {
		if exempted || e.Domain() != domain {
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
