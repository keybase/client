package teams

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// Collection of ordering constraints waiting to be verified.
// TODO implement
type proofSetT struct{}

func newProofSet() *proofSetT {
	return &proofSetT{}
}

// --------------------------------------------------

// An operation that occurs simultaneously on the child and parent team chains
// TODO implement
type parentChildOperation struct {
}

// --------------------------------------------------

type chainLinkUnpacked struct {
	source    *SCChainLink
	outerLink *libkb.OuterLinkV2WithMetadata
	// inner is nil if the link is stubbed
	inner *SCChainLinkPayload
}

func unpackChainLink(link *SCChainLink) (*chainLinkUnpacked, error) {
	outerLink, err := libkb.DecodeOuterLinkV2(link.Sig)
	if err != nil {
		return nil, err
	}
	err = outerLink.AssertSomeFields(link.Version, link.Seqno)
	if err != nil {
		return nil, err
	}
	var inner *SCChainLinkPayload
	if link.Payload == "" {
		// stubbed inner link
	} else {
		payload, err := link.UnmarshalPayload()
		if err != nil {
			return nil, fmt.Errorf("error unmarshaling link payload: %s", err)
		}
		inner = &payload
	}
	ret := &chainLinkUnpacked{
		source:    link,
		outerLink: outerLink,
		inner:     inner,
	}

	return ret, nil
}

func (l *chainLinkUnpacked) Seqno() keybase1.Seqno {
	return l.outerLink.Seqno
}

func (l *chainLinkUnpacked) LinkType() libkb.SigchainV2Type {
	return l.outerLink.LinkType
}

func (l *chainLinkUnpacked) isStubbed() bool {
	return l.inner == nil
}
