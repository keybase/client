
package libkb

import (
	"fmt"
)

type TypedChainLink interface {
	GetRevocations() []*SigId
	insertIntoTable(tab *IdTable)
	GetSigId() SigId
}

type TypedChainLinkBase struct {
	*ChainLink
	revoked bool
}

type RemoteProofChainLink struct {
	TypedChainLinkBase
}

func (b TypedChainLinkBase) GetSigId() SigId {
	return b.unpacked.sigId
}

func (l RemoteProofChainLink) TableKey() string {
	jw := l.payloadJson.AtKey("body").AtKey("service")
	if p, e2 := jw.AtKey("protocol").GetString(); e2 != nil {
		if p == "dns" || p == "http" || p == "https" {
			return "web"
		} else {
			return ""
		}
	} else if n, e3 := jw.AtKey("name").GetString(); e3 != nil {
		return n
	} else {
		return ""
	}
}

func (l RemoteProofChainLink) insertIntoTable(tab *IdTable) {
	tab.insertLink(l)
}

type TrackChainLink struct {
	TypedChainLinkBase
}

type CryptocurrencyChainLink struct {
	TypedChainLinkBase
}

type RevokeChainLink struct {
	TypedChainLinkBase
}

type UntrackChainLink struct {
	TypedChainLinkBase
}

type SelfSigChainLink struct {
	TypedChainLinkBase
}

type IdTable struct {
	SigChain        *SigChain
	Revocations     map[SigId]bool
	Links           map[SigId]TypedChainLink
	RemoteProofs    map[string]RemoteProofChainLink
	Tracks          map[string]TrackChainLink
}

func (tab *IdTable) insertLink(l TypedChainLink) {
	tab.Links[l.GetSigId()] = l
}

func NewTypedChainLink(cl *ChainLink) (ret TypedChainLink, err error) {
	var s string
	s, err = cl.payloadJson.AtKey("body").AtKey("type").GetString()
	if err != nil {
		return
	}

	base := TypedChainLinkBase { cl, false }
	switch s {
	case "web_service_binding":
		ret = RemoteProofChainLink { base }
	default:
		err = fmt.Errorf("Unknown signature type: %s", s)
	}

	return
}
