// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//
// Similar to libkb/kbsigs.go, but for teams sigs.
//
package teams

import (
	"encoding/hex"
	"errors"
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

// metaContext returns a GlobalContext + a TODO context, since we're not
// threading through contexts through this library. In the future, we should
// fix this.
func metaContext(g *libkb.GlobalContext) libkb.MetaContext {
	return libkb.NewMetaContextTODO(g)
}

func TeamRootSig(g *libkb.GlobalContext, me libkb.UserForSignatures, key libkb.GenericKey, teamSection SCTeamSection) (*jsonw.Wrapper, error) {
	hPrevInfo := libkb.NewInitialHPrevInfo()
	ret, err := libkb.ProofMetadata{
		SigningUser:       me,
		Eldest:            me.GetEldestKID(),
		LinkType:          libkb.LinkTypeTeamRoot,
		SigningKey:        key,
		Seqno:             1,
		SigVersion:        libkb.KeybaseSignatureV2,
		SeqType:           seqTypeForTeamPublicness(teamSection.Public),
		HPrevInfoFallback: &hPrevInfo,
	}.ToJSON(metaContext(g))
	if err != nil {
		return nil, err
	}

	teamSectionJSON, err := jsonw.WrapperFromObject(teamSection)
	if err != nil {
		return nil, err
	}
	teamSectionJSON.SetValueAtPath("per_team_key.reverse_sig", jsonw.NewNil())

	body := ret.AtKey("body")
	body.SetKey("team", teamSectionJSON)

	return ret, nil
}

func NewImplicitTeamName() (res keybase1.TeamName, err error) {
	dat, err := libkb.RandBytes(keybase1.ImplicitSuffixLengthBytes)
	if err != nil {
		return res, err
	}
	res, err = keybase1.TeamNameFromString(fmt.Sprintf("%s%s", keybase1.ImplicitTeamPrefix, hex.EncodeToString(dat)))
	return res, err
}

func NewSubteamSig(g *libkb.GlobalContext, me libkb.UserForSignatures, key libkb.GenericKey, parentTeam *TeamSigChainState, subteamName keybase1.TeamName, subteamID keybase1.TeamID, admin *SCTeamAdmin) (*jsonw.Wrapper, error) {
	prevLinkID, err := libkb.ImportLinkID(parentTeam.GetLatestLinkID())
	if err != nil {
		return nil, err
	}
	hPrevInfo, err := parentTeam.GetHPrevInfo()
	if err != nil {
		return nil, err
	}
	ret, err := libkb.ProofMetadata{
		SigningUser:       me,
		Eldest:            me.GetEldestKID(),
		LinkType:          libkb.LinkTypeNewSubteam,
		SigningKey:        key,
		SigVersion:        libkb.KeybaseSignatureV2,
		SeqType:           seqTypeForTeamPublicness(parentTeam.IsPublic()), // children are as public as their parent
		Seqno:             parentTeam.GetLatestSeqno() + 1,
		PrevLinkID:        prevLinkID,
		HPrevInfoFallback: &hPrevInfo,
	}.ToJSON(metaContext(g))
	if err != nil {
		return nil, err
	}

	entropy, err := makeSCTeamEntropy()
	if err != nil {
		return nil, err
	}

	teamSection := SCTeamSection{
		ID: (SCTeamID)(parentTeam.GetID()),
		Subteam: &SCSubteam{
			ID:   (SCTeamID)(subteamID),
			Name: (SCTeamName)(subteamName.String()),
		},
		Admin:   admin,
		Entropy: entropy,
	}
	teamSectionJSON, err := jsonw.WrapperFromObject(teamSection)
	if err != nil {
		return nil, err
	}
	ret.SetValueAtPath("body.team", teamSectionJSON)

	return ret, nil
}

func SubteamHeadSig(g *libkb.GlobalContext, me libkb.UserForSignatures, key libkb.GenericKey, subteamTeamSection SCTeamSection) (*jsonw.Wrapper, error) {
	hPrevInfo := libkb.NewInitialHPrevInfo()
	ret, err := libkb.ProofMetadata{
		SigningUser:       me,
		Eldest:            me.GetEldestKID(),
		LinkType:          libkb.LinkTypeSubteamHead,
		SigningKey:        key,
		Seqno:             1,
		SigVersion:        libkb.KeybaseSignatureV2,
		SeqType:           seqTypeForTeamPublicness(subteamTeamSection.Public),
		HPrevInfoFallback: &hPrevInfo,
	}.ToJSON(metaContext(g))
	if err != nil {
		return nil, err
	}

	// Note that the team section here is expected to have its Parent
	// subsection filled out by the caller, unlike TeamRootSig.
	teamSectionJSON, err := jsonw.WrapperFromObject(subteamTeamSection)
	if err != nil {
		return nil, err
	}
	teamSectionJSON.SetValueAtPath("per_team_key.reverse_sig", jsonw.NewNil())

	body := ret.AtKey("body")
	body.SetKey("team", teamSectionJSON)

	return ret, nil
}

func RenameSubteamSig(g *libkb.GlobalContext, me libkb.UserForSignatures, key libkb.GenericKey, parentTeam *TeamSigChainState, teamSection SCTeamSection) (*jsonw.Wrapper, error) {
	prev, err := parentTeam.GetLatestLibkbLinkID()
	if err != nil {
		return nil, err
	}
	hPrevInfo, err := parentTeam.GetHPrevInfo()
	if err != nil {
		return nil, err
	}
	ret, err := libkb.ProofMetadata{
		SigningUser:       me,
		Eldest:            me.GetEldestKID(),
		LinkType:          libkb.LinkTypeRenameSubteam,
		SigningKey:        key,
		Seqno:             parentTeam.GetLatestSeqno() + 1,
		PrevLinkID:        prev,
		SigVersion:        libkb.KeybaseSignatureV2,
		SeqType:           seqTypeForTeamPublicness(teamSection.Public),
		HPrevInfoFallback: &hPrevInfo,
	}.ToJSON(metaContext(g))
	if err != nil {
		return nil, err
	}

	teamSectionJSON, err := jsonw.WrapperFromObject(teamSection)
	if err != nil {
		return nil, err
	}

	body := ret.AtKey("body")
	body.SetKey("team", teamSectionJSON)

	return ret, nil
}

func RenameUpPointerSig(g *libkb.GlobalContext, me libkb.UserForSignatures, key libkb.GenericKey, subteam *TeamSigChainState, teamSection SCTeamSection) (*jsonw.Wrapper, error) {
	prev, err := subteam.GetLatestLibkbLinkID()
	if err != nil {
		return nil, err
	}
	hPrevInfo, err := subteam.GetHPrevInfo()
	if err != nil {
		return nil, err
	}
	ret, err := libkb.ProofMetadata{
		SigningUser:       me,
		Eldest:            me.GetEldestKID(),
		LinkType:          libkb.LinkTypeRenameUpPointer,
		SigningKey:        key,
		Seqno:             subteam.GetLatestSeqno() + 1,
		PrevLinkID:        prev,
		SigVersion:        libkb.KeybaseSignatureV2,
		SeqType:           seqTypeForTeamPublicness(teamSection.Public),
		HPrevInfoFallback: &hPrevInfo,
	}.ToJSON(metaContext(g))
	if err != nil {
		return nil, err
	}

	teamSectionJSON, err := jsonw.WrapperFromObject(teamSection)
	if err != nil {
		return nil, err
	}

	body := ret.AtKey("body")
	body.SetKey("team", teamSectionJSON)

	return ret, nil
}

// 15 random bytes, followed by the byte 0x25, encoded as hex
func NewSubteamID(public bool) keybase1.TeamID {
	var useSuffix byte = keybase1.SUB_TEAMID_PRIVATE_SUFFIX
	if public {
		useSuffix = keybase1.SUB_TEAMID_PUBLIC_SUFFIX
	}
	idBytes, err := libkb.RandBytesWithSuffix(16, useSuffix)
	if err != nil {
		panic("RandBytes failed: " + err.Error())
	}
	return keybase1.TeamID(hex.EncodeToString(idBytes))
}

func NewInviteID() SCTeamInviteID {
	b, err := libkb.RandBytesWithSuffix(16, libkb.InviteIDTag)
	if err != nil {
		panic("RandBytes failed: " + err.Error())
	}
	return SCTeamInviteID(hex.EncodeToString(b))
}

func ChangeSig(g *libkb.GlobalContext, me libkb.UserForSignatures, prev libkb.LinkID, seqno keybase1.Seqno, key libkb.GenericKey, teamSection SCTeamSection,
	linkType libkb.LinkType, merkleRoot *libkb.MerkleRoot, hPrevInfo libkb.HPrevInfo) (*jsonw.Wrapper, error) {
	if teamSection.PerTeamKey != nil {
		if teamSection.PerTeamKey.ReverseSig != "" {
			return nil, errors.New("ChangeMembershipSig called with PerTeamKey.ReverseSig already set")
		}
	}

	ret, err := libkb.ProofMetadata{
		LinkType:          linkType,
		SigningUser:       me,
		Eldest:            me.GetEldestKID(),
		SigningKey:        key,
		Seqno:             seqno,
		PrevLinkID:        prev,
		SigVersion:        libkb.KeybaseSignatureV2,
		SeqType:           seqTypeForTeamPublicness(teamSection.Public),
		MerkleRoot:        merkleRoot,
		HPrevInfoFallback: &hPrevInfo,
	}.ToJSON(metaContext(g))
	if err != nil {
		return nil, err
	}

	teamSectionJSON, err := jsonw.WrapperFromObject(teamSection)
	if err != nil {
		return nil, err
	}

	body := ret.AtKey("body")
	body.SetKey("team", teamSectionJSON)

	return ret, nil
}

func makeSCTeamEntropy() (SCTeamEntropy, error) {
	entropy, err := libkb.LinkEntropy()
	if err != nil {
		return SCTeamEntropy(""), err
	}
	return SCTeamEntropy(entropy), nil
}

func seqTypeForTeamPublicness(public bool) keybase1.SeqType {
	if public {
		return keybase1.SeqType_PUBLIC
	}
	return keybase1.SeqType_SEMIPRIVATE
}

func precheckLinkToPost(ctx context.Context, g *libkb.GlobalContext,
	sigMultiItem libkb.SigMultiItem, state *TeamSigChainState, me keybase1.UserVersion) (err error) {
	return precheckLinksToPost(ctx, g, []libkb.SigMultiItem{sigMultiItem}, state, me)
}

func precheckLinksToPost(ctx context.Context, g *libkb.GlobalContext,
	sigMultiItems []libkb.SigMultiItem, state *TeamSigChainState, me keybase1.UserVersion) (err error) {

	defer g.CTraceTimed(ctx, "precheckLinksToPost", func() error { return err })()

	isAdmin := true
	if state != nil {
		role, err := state.GetUserRole(me)
		if err != nil {
			role = keybase1.TeamRole_NONE
		}
		isAdmin = role.IsAdminOrAbove()

		// As an optimization, AppendChainLink consumes its state.
		// We don't consume our state parameter.
		// So clone state before we pass it along to be consumed.
		state = state.DeepCopyToPtr()
	}

	signer := SignerX{
		signer:        me,
		implicitAdmin: !isAdmin,
	}

	for _, sigItem := range sigMultiItems {
		outerLink, err := libkb.DecodeOuterLinkV2(sigItem.Sig)
		if err != nil {
			return NewPrecheckStructuralError("unpack outer", err)
		}

		link1 := SCChainLink{
			Seqno:   outerLink.Seqno,
			Sig:     sigItem.Sig,
			Payload: sigItem.SigInner,
			UID:     me.Uid,
			Version: 2,
		}
		link2, err := unpackChainLink(&link1)
		if err != nil {
			return NewPrecheckStructuralError("unpack link", err)
		}

		if link2.isStubbed() {
			return NewPrecheckStructuralError("link missing inner", nil)
		}

		newState, err := AppendChainLink(ctx, g, me, state, link2, &signer)
		if err != nil {
			return NewPrecheckAppendError(err)
		}
		state = &newState
	}

	return nil
}
