package teams

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// --------------------------------------------------

// An operation that occurs simultaneously on the child and parent team chains
// TODO implement
type parentChildOperation struct {
	TODOImplement bool
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

func (l *chainLinkUnpacked) Prev() libkb.LinkID {
	return l.outerLink.Prev
}

func (l *chainLinkUnpacked) LinkID() libkb.LinkID {
	return l.outerLink.LinkID()
}

func (l *chainLinkUnpacked) LinkType() libkb.SigchainV2Type {
	return l.outerLink.LinkType
}

func (l *chainLinkUnpacked) isStubbed() bool {
	return l.inner == nil
}

func (l chainLinkUnpacked) SignatureMetadata() keybase1.SignatureMetadata {
	return keybase1.SignatureMetadata{
		PrevMerkleRootSigned: l.inner.Body.MerkleRoot.ToMerkleRootV2(),
		SigChainLocation:     l.inner.ToSigChainLocation(),
	}
}
