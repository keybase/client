// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//
// Similar to libkb/kbsigs.go, but for teams sigs.
//
package teams

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

type TeamSection struct {
	Name    string          `json:"name"`
	ID      keybase1.TeamID `json:"id"`
	Members struct {
		Owner  []libkb.NameWithEldestSeqno `json:"owner"`
		Admin  []libkb.NameWithEldestSeqno `json:"admin"`
		Writer []libkb.NameWithEldestSeqno `json:"writer"`
		Reader []libkb.NameWithEldestSeqno `json:"reader"`
	} `json:"members"`
	PerTeamKey struct {
		Generation    int          `json:"generation"`
		EncryptionKID keybase1.KID `json:"encryption_kid"`
		SigningKID    keybase1.KID `json:"signing_kid"`
		// reverse_sig always gets set to null, and the caller has to overwrite it afterwards
	} `json:"per_team_key"`
	Parent *ParentSection `json:"parent,omitempty"`
}

type ParentSection struct {
	ID    keybase1.TeamID `json:"id"`
	Seqno keybase1.Seqno  `json:"seqno"`
}

func TeamRootSig(me *libkb.User, key libkb.GenericKey, teamSection TeamSection) (*jsonw.Wrapper, error) {
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

// the first 15 bytes of the sha256 of the lowercase team name, followed by the byte 0x24, encoded as hex
func RootTeamIDFromName(name string) keybase1.TeamID {
	sum := sha256.Sum256([]byte(strings.ToLower(name)))
	return keybase1.TeamID(hex.EncodeToString(sum[0:15]) + "24")
}

func NewSubteamSig(me *libkb.User, key libkb.GenericKey, parentTeam *TeamSigChainState, subteamFQName string, subteamID keybase1.TeamID) (*jsonw.Wrapper, error) {
	ret, err := libkb.ProofMetadata{
		Me:         me,
		LinkType:   libkb.LinkTypeNewSubteam,
		SigningKey: key,
		SigVersion: libkb.KeybaseSignatureV2,
		SeqType:    libkb.SeqTypeSemiprivate,
		Seqno:      parentTeam.GetLatestSeqno() + 1,
		PrevLinkID: parentTeam.GetLatestLinkID(),
	}.ToJSON(me.G())
	if err != nil {
		return nil, err
	}

	subteamSection := jsonw.NewDictionary()
	subteamSection.SetKey("id", jsonw.NewString(string(subteamID)))
	subteamSection.SetKey("name", jsonw.NewString(subteamFQName))
	teamSection := jsonw.NewDictionary()
	teamSection.SetKey("id", jsonw.NewString(string(parentTeam.ID)))
	teamSection.SetKey("subteam", subteamSection)
	body := ret.AtKey("body")
	body.SetKey("team", teamSection)

	return ret, nil
}

func SubteamHeadSig(me *libkb.User, key libkb.GenericKey, subteamTeamSection TeamSection) (*jsonw.Wrapper, error) {
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
	randBytes, err := libkb.RandBytes(15)
	if err != nil {
		panic("RandBytes failed: " + err.Error())
	}
	return keybase1.TeamID(hex.EncodeToString(randBytes) + "25")
}
