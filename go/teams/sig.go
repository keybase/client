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

// the first 15 bytes of the sha256 of the lowercase team name, followed by the byte 0x24, encoded as hex
func RootTeamIDFromName(name string) keybase1.TeamID {
	sum := sha256.Sum256([]byte(strings.ToLower(name)))
	idBytes := sum[0:16]
	idBytes[15] = libkb.RootTeamIDTag
	return keybase1.TeamID(hex.EncodeToString(idBytes))
}

func NewSubteamSig(me *libkb.User, key libkb.GenericKey, parentTeam *TeamSigChainState, subteamName TeamName, subteamID keybase1.TeamID) (*jsonw.Wrapper, error) {
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

	teamSection := SCTeamSection{
		ID: (SCTeamID)(parentTeam.GetID()),
		Subteam: &SCSubteam{
			ID:   (SCTeamID)(subteamID),
			Name: (SCTeamName)(subteamName),
		},
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

/*
{"sigs":[{"sig":"g6Rib2R5hqhkZXRhY2hlZMOpaGFzaF90eXBlCqNrZXnEIwEgk7WgUmzLFxTvDFme5W+YKM1XQQmOW0FC39e/XbruS40Kp3BheWxvYWTESJUCAsQgebHp66NqwDVy6g5uyTqQZd58aljDUrvt63Y+9RbS8X3EIHsoCOpE+EiT5qXKUaS03HhZHRotha4mKAa++mqO9nstI6NzaWfEQAVvzWA3td0YRQsdWY1b4dJ7hOW0/t/C52tUbRMN3OUUpm1lbXnNe5ELalCdiE+eX7ebqhAzw2hrC0PE4NxKCAqoc2lnX3R5cGUgo3RhZ80CAqd2ZXJzaW9uAQ==","sig_id_base":"c02127459017740b1c54c6c57c4c196e2ae57aadfd8a2838e7b5c9d7ee1d2842","sig_id_short":"wCEnRZAXdAscVMbFfEwZbirleq39iig457XJ","is_remote_proof":false,"type":"team.change_membership","seq_type":"PUBLIC","public_key":null,"public_keys":{},"eldest_kid":"012093b5a0526ccb1714ef0c599ee56f9828cd5741098e5b4142dfd7bf5dbaee4b8d0a","signing_kid":"012093b5a0526ccb1714ef0c599ee56f9828cd5741098e5b4142dfd7bf5dbaee4b8d0a","sig_inner":"{\"body\":{\"key\":{\"eldest_kid\":\"012093b5a0526ccb1714ef0c599ee56f9828cd5741098e5b4142dfd7bf5dbaee4b8d0a\",\"host\":\"keybase.io\",\"kid\":\"012093b5a0526ccb1714ef0c599ee56f9828cd5741098e5b4142dfd7bf5dbaee4b8d0a\",\"uid\":\"26afc579e33920cc7d8f37fbe892e919\",\"username\":\"d_9dcf04f5\"},\"team\":{\"id\":\"d2b275a44663cac54188c2f744451124\",\"members\":{\"admin\":[\"b_4efbcb8f\"],\"reader\":[\"a_9491df70\"],\"writer\":[\"c_3920b398\"]}},\"type\":\"team.change_membership\",\"version\":2},\"ctime\":1495731460,\"expire_in\":157680000,\"prev\":\"79b1e9eba36ac03572ea0e6ec93a9065de7c6a58c352bbedeb763ef516d2f17d\",\"seq_type\":3,\"seqno\":2,\"tag\":\"signature\"}","team_id":"d2b275a44663cac54188c2f744451124"}],"per_team_secrets":{"generation":1,"encrypting_kid":"012148f99094cc56d17f6990444d9d1af4dd0ef989e636e4938462e7854777f8462f0a","nonce":"VhGfWBpC8vYR34r2vO9QamYKBZE=","boxes":{"b_4efbcb8f":"lAEDAcQwiJiF204/7x5yJbX9C/AO37EPvABQvrFTleX5jrvatXdNqjHkPmJoMPQOQrcASIlx","c_3920b398":"lAEDAsQw1U+0z1naKfuMsIouSyOEeC3cEHAs7KKgPtHEWyDwQmj+979ePqTqLolMvVsymWYI","a_9491df70":"lAEDA8Qw5SDHClBsQJ+kIoJt+DUdUBQD6xhQmQkIgr3CNNyzWtJ6MiXtH6Uh89rBDPN0bbDe"}}}
*/

/*
{
   "sigs":[
      {
         "sig":"g6Rib2R5hqhkZXRhY2hlZMOpaGFzaF90eXBlCqNrZXnEIwEgk7WgUmzLFxTvDFme5W+YKM1XQQmOW0FC39e/XbruS40Kp3BheWxvYWTESJUCAsQgebHp66NqwDVy6g5uyTqQZd58aljDUrvt63Y+9RbS8X3EIHsoCOpE+EiT5qXKUaS03HhZHRotha4mKAa++mqO9nstI6NzaWfEQAVvzWA3td0YRQsdWY1b4dJ7hOW0/t/C52tUbRMN3OUUpm1lbXnNe5ELalCdiE+eX7ebqhAzw2hrC0PE4NxKCAqoc2lnX3R5cGUgo3RhZ80CAqd2ZXJzaW9uAQ==",
         "sig_id_base":"c02127459017740b1c54c6c57c4c196e2ae57aadfd8a2838e7b5c9d7ee1d2842",
         "sig_id_short":"wCEnRZAXdAscVMbFfEwZbirleq39iig457XJ",
         "is_remote_proof":false,
         "type":"team.change_membership",
         "seq_type":"PUBLIC",
         "public_key":null,
         "public_keys":{

         },
         "eldest_kid":"012093b5a0526ccb1714ef0c599ee56f9828cd5741098e5b4142dfd7bf5dbaee4b8d0a",
         "signing_kid":"012093b5a0526ccb1714ef0c599ee56f9828cd5741098e5b4142dfd7bf5dbaee4b8d0a",
         "sig_inner":"{\"body\":{\"key\":{\"eldest_kid\":\"012093b5a0526ccb1714ef0c599ee56f9828cd5741098e5b4142dfd7bf5dbaee4b8d0a\",\"host\":\"keybase.io\",\"kid\":\"012093b5a0526ccb1714ef0c599ee56f9828cd5741098e5b4142dfd7bf5dbaee4b8d0a\",\"uid\":\"26afc579e33920cc7d8f37fbe892e919\",\"username\":\"d_9dcf04f5\"},\"team\":{\"id\":\"d2b275a44663cac54188c2f744451124\",\"members\":{\"admin\":[\"b_4efbcb8f\"],\"reader\":[\"a_9491df70\"],\"writer\":[\"c_3920b398\"]}},\"type\":\"team.change_membership\",\"version\":2},\"ctime\":1495731460,\"expire_in\":157680000,\"prev\":\"79b1e9eba36ac03572ea0e6ec93a9065de7c6a58c352bbedeb763ef516d2f17d\",\"seq_type\":3,\"seqno\":2,\"tag\":\"signature\"}",
         "team_id":"d2b275a44663cac54188c2f744451124"
      }
   ],
   "per_team_secrets":{
      "generation":1,
      "encrypting_kid":"012148f99094cc56d17f6990444d9d1af4dd0ef989e636e4938462e7854777f8462f0a",
      "nonce":"VhGfWBpC8vYR34r2vO9QamYKBZE=",
      "boxes":{
         "b_4efbcb8f":"lAEDAcQwiJiF204/7x5yJbX9C/AO37EPvABQvrFTleX5jrvatXdNqjHkPmJoMPQOQrcASIlx",
         "c_3920b398":"lAEDAsQw1U+0z1naKfuMsIouSyOEeC3cEHAs7KKgPtHEWyDwQmj+979ePqTqLolMvVsymWYI",
         "a_9491df70":"lAEDA8Qw5SDHClBsQJ+kIoJt+DUdUBQD6xhQmQkIgr3CNNyzWtJ6MiXtH6Uh89rBDPN0bbDe"
      }
   }
}
*/

func ChangeMembershipSig(me *libkb.User, prev libkb.LinkID, seqno keybase1.Seqno, key libkb.GenericKey, teamSection SCTeamSection) (*jsonw.Wrapper, error) {
	ret, err := libkb.ProofMetadata{
		Me:         me,
		LinkType:   libkb.LinkTypeChangeMembership,
		SigningKey: key,
		Seqno:      seqno,
		PrevLinkID: prev,
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

	body := ret.AtKey("body")
	body.SetKey("team", teamSectionJSON)

	return ret, nil
}
