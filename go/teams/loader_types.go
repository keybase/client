package teams

import (
	"crypto/sha256"
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
	ID        keybase1.TeamID
	source    *SCChainLink
	outerLink *libkb.OuterLinkV2WithMetadata
	// inner is nil if the link is stubbed
	inner *SCChainLinkPayload
	// innerLinkID is nil if inner is nil (if the link is stubbed)
	innerLinkID libkb.LinkID
}

func unpackChainLink(id keybase1.TeamID, link *SCChainLink) (*chainLinkUnpacked, error) {
	outerLink, err := libkb.DecodeOuterLinkV2(link.Sig)
	if err != nil {
		return nil, err
	}
	err = outerLink.AssertSomeFields(link.Version, link.Seqno)
	if err != nil {
		return nil, err
	}
	var inner *SCChainLinkPayload
	var innerLinkID libkb.LinkID
	if link.Payload == "" {
		// stubbed inner link
	} else {
		payload, err := link.UnmarshalPayload()
		if err != nil {
			return nil, fmt.Errorf("error unmarshaling link payload: %s", err)
		}
		inner = &payload
		tmp := sha256.Sum256([]byte(link.Payload))
		innerLinkID = libkb.LinkID(tmp[:])
		innerTeamID, err := inner.TeamID()
		if err != nil {
			return nil, err
		}
		if !innerTeamID.Eq(id) {
			return nil, fmt.Errorf("Wrong teamID in inner link (%s != %s)", id, innerTeamID)
		}
	}
	ret := &chainLinkUnpacked{
		ID:          id,
		source:      link,
		outerLink:   outerLink,
		inner:       inner,
		innerLinkID: innerLinkID,
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
	return l.inner.SignatureMetadata()
}

func (l chainLinkUnpacked) SigChainLocation() keybase1.SigChainLocation {
	return l.inner.SigChainLocation()
}

func (i *SCChainLinkPayload) SignatureMetadata() keybase1.SignatureMetadata {
	return keybase1.SignatureMetadata{
		PrevMerkleRootSigned: i.Body.MerkleRoot.ToMerkleRootV2(),
		SigChainLocation:     i.SigChainLocation(),
	}
}

func (l *chainLinkUnpacked) AssertInnerOuterMatch() (err error) {
	var prev libkb.LinkID
	if l.inner.Prev != nil {
		prev, err = libkb.LinkIDFromHex(*l.inner.Prev)
		if err != nil {
			return err
		}
	}
	linkType, err := libkb.SigchainV2TypeFromV1TypeTeams(l.inner.Body.Type)
	if err != nil {
		return err
	}

	return l.outerLink.AssertFields(l.inner.Body.Version, l.inner.Seqno, prev, l.innerLinkID, linkType)
}
