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

type SignerX struct {
	signer keybase1.UserVersion
	// Whether the user is definitely an implicit admin
	implicitAdmin bool
}

func NewSignerX(signer keybase1.UserVersion, implicitAdmin bool) SignerX {
	return SignerX{signer, implicitAdmin}
}

// --------------------------------------------------

type ChainLinkUnpacked struct {
	source    *SCChainLink
	outerLink *libkb.OuterLinkV2WithMetadata
	// inner is nil if the link is stubbed
	inner *SCChainLinkPayload
	// nil if the link is stubbed
	innerLinkID libkb.LinkID
	// nil if the link is stubbed
	innerTeamID keybase1.TeamID
}

func UnpackChainLink(link *SCChainLink) (*ChainLinkUnpacked, error) {
	return unpackChainLink(link)
}

func unpackChainLink(link *SCChainLink) (*ChainLinkUnpacked, error) {
	var outerLink *libkb.OuterLinkV2WithMetadata
	var err error
	switch {
	case link.Sig != "":
		outerLink, err = libkb.DecodeOuterLinkV2(link.Sig)
	case link.SigV2Payload != "":
		outerLink, err = libkb.DecodeStubbedOuterLinkV2(link.SigV2Payload)
	default:
		return nil, fmt.Errorf("cannot decode chain link, no sig v2 payload")
	}
	if err != nil {
		return nil, fmt.Errorf("unpack outer: %v", err)
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
			return nil, fmt.Errorf("unmarshaling link payload: %v", err)
		}
		inner = &payload
		tmp := sha256.Sum256([]byte(link.Payload))
		innerLinkID = libkb.LinkID(tmp[:])
		innerTeamID, err = inner.TeamID()
		if err != nil {
			return nil, err
		}
	}
	ret := &ChainLinkUnpacked{
		source:      link,
		outerLink:   outerLink,
		inner:       inner,
		innerLinkID: innerLinkID,
		innerTeamID: innerTeamID,
	}
	return ret, nil
}

func (l *ChainLinkUnpacked) Seqno() keybase1.Seqno {
	return l.outerLink.Seqno
}

func (l *ChainLinkUnpacked) SeqType() keybase1.SeqType {
	return l.outerLink.SeqType
}

func (l *ChainLinkUnpacked) Prev() libkb.LinkID {
	return l.outerLink.Prev
}

func (l *ChainLinkUnpacked) LinkID() libkb.LinkID {
	return l.outerLink.LinkID()
}

func (l *ChainLinkUnpacked) SigID() keybase1.SigID {
	return l.outerLink.SigID()
}

func (l *ChainLinkUnpacked) LinkType() libkb.SigchainV2Type {
	return l.outerLink.LinkType
}

func (l *ChainLinkUnpacked) isStubbed() bool {
	return l.inner == nil
}

func (l ChainLinkUnpacked) SignatureMetadata() keybase1.SignatureMetadata {
	return l.inner.SignatureMetadata()
}

func (l ChainLinkUnpacked) SigChainLocation() keybase1.SigChainLocation {
	return l.inner.SigChainLocation()
}

func (l ChainLinkUnpacked) LinkTriple() keybase1.LinkTriple {
	return keybase1.LinkTriple{
		Seqno:   l.Seqno(),
		SeqType: l.SeqType(),
		LinkID:  l.LinkID().Export(),
	}
}

func (i *SCChainLinkPayload) SignatureMetadata() keybase1.SignatureMetadata {
	return keybase1.SignatureMetadata{
		PrevMerkleRootSigned: i.Body.MerkleRoot.ToMerkleRootV2(),
		SigChainLocation:     i.SigChainLocation(),
	}
}

func (l *ChainLinkUnpacked) AssertInnerOuterMatch() (err error) {
	if l.inner == nil {
		return fmt.Errorf("cannot check inner-outer match without inner link")
	}

	var prev libkb.LinkID
	if l.inner.Prev != nil {
		prev, err = libkb.LinkIDFromHex(*l.inner.Prev)
		if err != nil {
			return err
		}
	}

	linkType, err := libkb.SigchainV2TypeFromV1TypeTeams(l.inner.Body.Type)
	if err != nil {
		if l.outerLink.LinkType.IsSupportedTeamType() {
			// Supported outer type but unrecognized inner type.
			return err
		}
		if !l.outerLink.IgnoreIfUnsupported {
			// Unsupported outer type marked as critical.
			return NewUnsupportedLinkTypeError(l.outerLink.LinkType, l.inner.Body.Type)
		}

		// If the inner link type is not recognized, and the outer link type is not a valid
		// team link type. Then this may be a link type from the future.
		// Let it slide without really checking that the inner and outer types match
		// (because this client doesn't know the mapping).
		// By assigning this tautology, which will always pass AssertFields.
		linkType = l.outerLink.LinkType
	}

	useSeqType := l.inner.SeqType
	if l.outerLink.SeqType == 0 {
		// There are links where seq_type is unset on the outer link
		// but set on the inner link.
		// Let these pass.
		useSeqType = l.outerLink.SeqType
	}

	var hPrevInfoPtr *libkb.HPrevInfo
	if hPrevInfoStr := l.inner.HPrevInfo; hPrevInfoStr != nil {
		hPrevInfo, err := hPrevInfoStr.ToLibkbHPrevInfo()
		if err != nil {
			return nil
		}
		hPrevInfoPtr = &hPrevInfo
	}

	return l.outerLink.AssertFields(
		l.inner.Body.Version,
		l.inner.Seqno,
		prev,
		l.innerLinkID,
		linkType,
		useSeqType,
		l.inner.IgnoreIfUnsupported,
		hPrevInfoPtr)
}
