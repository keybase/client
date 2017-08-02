package teams

import (
	"crypto/sha256"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// --------------------------------------------------

// An operation that occurs simultaneously on the child and parent team chains.
// This struct holds the child half of the operation.
type parentChildOperation struct {
	// The seqno in the parent sigchain that corresponds to this operation.
	parentSeqno keybase1.Seqno
	// The type of the child link
	linkType libkb.SigchainV2Type
	// The new subteam name. The only PCOs at the mo' are subteam renames.
	newName keybase1.TeamName
}

// --------------------------------------------------

type signerX struct {
	signer keybase1.UserVersion
	// Whether the user is definitely an implicit admin
	implicitAdmin bool
}

// --------------------------------------------------

type chainLinkUnpacked struct {
	source    *SCChainLink
	outerLink *libkb.OuterLinkV2WithMetadata
	// inner is nil if the link is stubbed
	inner *SCChainLinkPayload
	// nil if the link is stubbed
	innerLinkID libkb.LinkID
	// nil if the link is stubbed
	innerTeamID keybase1.TeamID
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
	var innerLinkID libkb.LinkID
	var innerTeamID keybase1.TeamID
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
		innerTeamID, err = inner.TeamID()
		if err != nil {
			return nil, err
		}
	}
	ret := &chainLinkUnpacked{
		source:      link,
		outerLink:   outerLink,
		inner:       inner,
		innerLinkID: innerLinkID,
		innerTeamID: innerTeamID,
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
