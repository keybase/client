// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//
// Similar to libkb/kbsigs.go, but for teams sigs.
//
package teams

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

func TeamRootSig(me *libkb.User, key libkb.GenericKey, teamSection SCTeamSection) (*jsonw.Wrapper, error) {
	ret, err := libkb.ProofMetadata{
		Me:         me,
		LinkType:   libkb.LinkTypeTeamRoot,
		SigningKey: key,
		Seqno:      1,
		SigVersion: libkb.KeybaseSignatureV2,
		SeqType:    libkb.SeqTypeSemiprivate,
	}.ToJSON(me.G())
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

func RootTeamIDFromName(n keybase1.TeamName) keybase1.TeamID {
	if !n.IsRootTeam() {
		panic("can't get a team ID from a subteam")
	}
	return RootTeamIDFromNameString(n.String())
}

// the first 15 bytes of the sha256 of the lowercase team name, followed by the byte 0x24, encoded as hex
func RootTeamIDFromNameString(name string) keybase1.TeamID {
	sum := sha256.Sum256([]byte(strings.ToLower(name)))
	idBytes := sum[0:16]
	idBytes[15] = libkb.RootTeamIDTag
	return keybase1.TeamID(hex.EncodeToString(idBytes))
}

func NewSubteamSig(me *libkb.User, key libkb.GenericKey, parentTeam *TeamSigChainState, subteamName keybase1.TeamName, subteamID keybase1.TeamID, admin *SCTeamAdmin) (*jsonw.Wrapper, error) {
	prevLinkID, err := libkb.ImportLinkID(parentTeam.GetLatestLinkID())
	if err != nil {
		return nil, err
	}
	ret, err := libkb.ProofMetadata{
		Me:         me,
		LinkType:   libkb.LinkTypeNewSubteam,
		SigningKey: key,
		SigVersion: libkb.KeybaseSignatureV2,
		SeqType:    libkb.SeqTypeSemiprivate,
		Seqno:      parentTeam.GetLatestSeqno() + 1,
		PrevLinkID: prevLinkID,
	}.ToJSON(me.G())
	if err != nil {
		return nil, err
	}

	teamSection := SCTeamSection{
		ID: (SCTeamID)(parentTeam.GetID()),
		Subteam: &SCSubteam{
			ID:   (SCTeamID)(subteamID),
			Name: (SCTeamName)(subteamName.String()),
		},
		Admin: admin,
	}
	teamSectionJSON, err := jsonw.WrapperFromObject(teamSection)
	if err != nil {
		return nil, err
	}
	ret.SetValueAtPath("body.team", teamSectionJSON)

	return ret, nil
}

func SubteamHeadSig(me *libkb.User, key libkb.GenericKey, subteamTeamSection SCTeamSection) (*jsonw.Wrapper, error) {
	ret, err := libkb.ProofMetadata{
		Me:         me,
		LinkType:   libkb.LinkTypeSubteamHead,
		SigningKey: key,
		Seqno:      1,
		SigVersion: libkb.KeybaseSignatureV2,
		SeqType:    libkb.SeqTypeSemiprivate,
	}.ToJSON(me.G())
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

// 15 random bytes, followed by the byte 0x25, encoded as hex
func NewSubteamID() keybase1.TeamID {
	idBytes, err := libkb.RandBytes(16)
	if err != nil {
		panic("RandBytes failed: " + err.Error())
	}
	idBytes[15] = libkb.SubteamIDTag
	return keybase1.TeamID(hex.EncodeToString(idBytes))
}

func ChangeSig(me *libkb.User, prev libkb.LinkID, seqno keybase1.Seqno, key libkb.GenericKey, teamSection SCTeamSection, linkType libkb.LinkType, merkleRoot *libkb.MerkleRoot, permanence bool) (*jsonw.Wrapper, error) {
	if teamSection.PerTeamKey != nil {
		if teamSection.PerTeamKey.ReverseSig != "" {
			return nil, errors.New("ChangeMembershipSig called with PerTeamKey.ReverseSig already set")
		}
	}

	ret, err := libkb.ProofMetadata{
		Me:         me,
		LinkType:   linkType,
		SigningKey: key,
		Seqno:      seqno,
		PrevLinkID: prev,
		SigVersion: libkb.KeybaseSignatureV2,
		SeqType:    libkb.SeqTypeSemiprivate,
		MerkleRoot: merkleRoot,
	}.ToJSON(me.G())
	if err != nil {
		return nil, err
	}

	teamSectionJSON, err := jsonw.WrapperFromObject(teamSection)
	if err != nil {
		return nil, err
	}

	body := ret.AtKey("body")
	body.SetKey("team", teamSectionJSON)

	body.SetKey("permanence", jsonw.NewBool(permanence))

	return ret, nil
}
