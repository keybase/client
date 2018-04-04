package ephemeral

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
)

type TeamEKSeed keybase1.Bytes32

func newTeamEphemeralSeed() (seed TeamEKSeed, err error) {
	randomSeed, err := makeNewRandomSeed()
	if err != nil {
		return seed, err
	}
	return TeamEKSeed(randomSeed), nil
}

func newTeamEKSeedFromBytes(b []byte) (s TeamEKSeed, err error) {
	seed, err := newEKSeedFromBytes(b)
	if err != nil {
		return s, err
	}
	return TeamEKSeed(seed), nil
}

func (s *TeamEKSeed) DeriveDHKey() *libkb.NaclDHKeyPair {
	return deriveDHKey(keybase1.Bytes32(*s), libkb.DeriveReasonTeamEKEncryption)
}

func postNewTeamEK(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, sig string, boxes *[]keybase1.TeamEkBoxMetadata) (err error) {
	defer g.CTrace(ctx, "postNewTeamEK", func() error { return err })()

	boxesJSON, err := json.Marshal(*boxes)
	if err != nil {
		return err
	}
	apiArg := libkb.APIArg{
		Endpoint:    "team/team_ek",
		SessionType: libkb.APISessionTypeREQUIRED,
		NetContext:  ctx,
		Args: libkb.HTTPArgs{
			"team_id": libkb.S{Val: string(teamID)},
			"sig":     libkb.S{Val: sig},
			"boxes":   libkb.S{Val: string(boxesJSON)},
		},
	}
	_, err = g.GetAPI().Post(apiArg)
	return err
}

func prepareNewTeamEK(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, signingKey libkb.NaclSigningKeyPair, membersMetadata map[keybase1.UID]keybase1.UserEkMetadata, merkleRoot libkb.MerkleRoot) (sig string, boxes *[]keybase1.TeamEkBoxMetadata, metadata keybase1.TeamEkMetadata, myBox *keybase1.TeamEkBoxed, err error) {
	defer g.CTrace(ctx, "prepareNewTeamEK", func() error { return err })()

	seed, err := newTeamEphemeralSeed()
	if err != nil {
		return "", nil, metadata, nil, err
	}

	prevStatement, err := fetchTeamEKStatement(ctx, g, teamID)
	if err != nil {
		return "", nil, metadata, nil, err
	}
	var generation keybase1.EkGeneration
	if prevStatement == nil {
		generation = 1 // start at generation 1
	} else {
		generation = prevStatement.CurrentTeamEkMetadata.Generation + 1
	}

	dhKeypair := seed.DeriveDHKey()

	metadata = keybase1.TeamEkMetadata{
		Kid:        dhKeypair.GetKID(),
		Generation: generation,
		HashMeta:   merkleRoot.HashMeta(),
		// The ctime is derivable from the hash meta, by fetching the hashed
		// root from the server, but including it saves readers a potential
		// extra round trip.
		Ctime: keybase1.TimeFromSeconds(merkleRoot.Ctime()),
	}

	// Get the list of existing teamEKs to form the full statement. Make sure
	// that if it's nil, we replace it with an empty slice. Although those are
	// practically the same in Go, they get serialized to different JSON.
	existingActiveMetadata, err := filterStaleTeamEKStatement(ctx, g, prevStatement, merkleRoot)
	if err != nil {
		return "", nil, metadata, nil, err
	}
	if existingActiveMetadata == nil {
		existingActiveMetadata = []keybase1.TeamEkMetadata{}
	}

	statement := keybase1.TeamEkStatement{
		CurrentTeamEkMetadata:  metadata,
		ExistingTeamEkMetadata: existingActiveMetadata,
	}
	statementJSON, err := json.Marshal(statement)
	if err != nil {
		return "", nil, metadata, nil, err
	}

	sig, _, err = signingKey.SignToString(statementJSON)
	if err != nil {
		return "", nil, metadata, nil, err
	}

	teamEK := keybase1.TeamEk{
		Seed:     keybase1.Bytes32(seed),
		Metadata: metadata,
	}
	boxes, myTeamEKBoxed, err := boxTeamEKForUsers(ctx, g, membersMetadata, teamEK)
	if err != nil {
		return "", nil, metadata, nil, err
	}
	return sig, boxes, metadata, myTeamEKBoxed, nil
}

func publishNewTeamEK(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, merkleRoot libkb.MerkleRoot) (metadata keybase1.TeamEkMetadata, err error) {
	defer g.CTrace(ctx, "publishNewTeamEK", func() error { return err })()

	team, err := teams.Load(ctx, g, keybase1.LoadTeamArg{
		ID: teamID,
	})
	if err != nil {
		return metadata, err
	}
	signingKey, err := team.SigningKey()
	if err != nil {
		return metadata, err
	}

	statementMap, err := fetchTeamMemberStatements(ctx, g, teamID)
	if err != nil {
		return metadata, err
	}
	membersMetadata, err := activeUserEKMetadata(ctx, g, statementMap, merkleRoot)
	if err != nil {
		return metadata, err
	}

	sig, boxes, metadata, myBox, err := prepareNewTeamEK(ctx, g, teamID, signingKey, membersMetadata, merkleRoot)
	if err != nil {
		return metadata, err
	}

	err = postNewTeamEK(ctx, g, teamID, sig, boxes)
	if err != nil {
		return metadata, err
	}

	if myBox == nil {
		g.Log.CWarningf(ctx, "No box made for own teamEK")
	} else {
		storage := g.GetTeamEKBoxStorage()
		err = storage.Put(ctx, teamID, metadata.Generation, *myBox)
		if err != nil {
			return metadata, err
		}
	}
	return metadata, nil
}

func boxTeamEKForUsers(ctx context.Context, g *libkb.GlobalContext, usersMetadata map[keybase1.UID]keybase1.UserEkMetadata, teamEK keybase1.TeamEk) (teamBoxes *[]keybase1.TeamEkBoxMetadata, myTeamEKBoxed *keybase1.TeamEkBoxed, err error) {
	defer g.CTrace(ctx, "boxTeamEKForUsers", func() error { return err })()

	myUID := g.Env.GetUID()
	i := 0
	boxes := make([]keybase1.TeamEkBoxMetadata, len(usersMetadata))
	for uid, metadata := range usersMetadata {
		recipientKey, err := libkb.ImportKeypairFromKID(metadata.Kid)
		if err != nil {
			return nil, nil, err
		}
		// Encrypting with a nil sender means we'll generate a random sender private key.
		box, err := recipientKey.EncryptToString(teamEK.Seed[:], nil)
		if err != nil {
			return nil, nil, err
		}
		boxMetadata := keybase1.TeamEkBoxMetadata{
			RecipientUID:        uid,
			RecipientGeneration: metadata.Generation,
			Box:                 box,
		}
		boxes[i] = boxMetadata
		i++

		if uid == myUID {
			myTeamEKBoxed = &keybase1.TeamEkBoxed{
				Box:              box,
				UserEkGeneration: metadata.Generation,
				Metadata:         teamEK.Metadata,
			}
		}
	}
	return &boxes, myTeamEKBoxed, err
}

type teamEKStatementResponse struct {
	Sig *string `json:"sig"`
}

// Returns nil if the team has never published a teamEK. If the team has
// published a teamEK, but has since rolled their PTK without publishing a new
// one, this function will also return nil and log a warning. This is a
// transitional thing, and eventually when all "reasonably up to date" clients
// in the wild have EK support, we will make that case an error.
func fetchTeamEKStatement(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID) (statement *keybase1.TeamEkStatement, err error) {
	defer g.CTrace(ctx, "fetchTeamEKStatement", func() error { return err })()

	apiArg := libkb.APIArg{
		Endpoint:    "team/team_ek",
		SessionType: libkb.APISessionTypeREQUIRED,
		NetContext:  ctx,
		Args: libkb.HTTPArgs{
			"team_id": libkb.S{Val: string(teamID)},
		},
	}
	res, err := g.GetAPI().Get(apiArg)
	if err != nil {
		return nil, err
	}

	parsedResponse := teamEKStatementResponse{}
	err = res.Body.UnmarshalAgain(&parsedResponse)
	if err != nil {
		return nil, err
	}

	// If the result field in the response is null, the server is saying that
	// the team has never published a teamEKStatement, stale or otherwise.
	if parsedResponse.Sig == nil {
		g.Log.CDebugf(ctx, "team has no teamEKStatement at all")
		return nil, nil
	}

	statement, wrongKID, err := verifySigWithLatestPTK(ctx, g, teamID, *parsedResponse.Sig)
	// Check the wrongKID condition before checking the error, since an error
	// is still returned in this case. TODO: Turn this warning into an error
	// after EK support is sufficiently widespread.
	if wrongKID {
		g.Log.CWarningf(ctx, "It looks like someone rolled the PTK without generating new ephemeral keys. They might be on an old version.")
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return statement, nil
}

// Verify that the blob is validly signed, and that the signing key is the
// given team's latest PTK, then parse its contents. If the blob is signed by
// the wrong KID, that's still an error, but we'll also return this special
// `wrongKID` flag. As a transitional measure while we wait for all clients in
// the wild to have EK support, callers will treat that case as "there is no
// key" and convert the error to a warning.
func verifySigWithLatestPTK(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, sig string) (statement *keybase1.TeamEkStatement, wrongKID bool, err error) {
	defer g.CTrace(ctx, "verifySigWithLatestPTK", func() error { return err })()

	signerKey, payload, _, err := libkb.NaclVerifyAndExtract(sig)
	if err != nil {
		return nil, false, err
	}

	// Verify the signing key corresponds to the latest PTK. We load the team's
	// from cache, but if the KID doesn't match, we try a forced reload to see
	// if the cache might've been stale. Only if the KID still doesn't match
	// after the reload do we complain.
	team, err := teams.Load(ctx, g, keybase1.LoadTeamArg{
		ID: teamID,
	})
	if err != nil {
		return nil, false, err
	}
	teamSigningKey, err := team.SigningKey()
	if err != nil {
		return nil, false, err
	}
	if !teamSigningKey.GetKID().Equal(signerKey.GetKID()) {
		// The latest PTK might be stale. Force a reload, then check this over again.
		team, err := teams.Load(ctx, g, keybase1.LoadTeamArg{
			ID:          teamID,
			ForceRepoll: true,
		})
		if err != nil {
			return nil, false, err
		}
		teamSigningKey, err = team.SigningKey()
		if err != nil {
			return nil, false, err
		}
		if !teamSigningKey.GetKID().Equal(signerKey.GetKID()) {
			return nil, true, fmt.Errorf("teamEK returned for PTK signing KID %s, but latest is %s",
				signerKey.GetKID(), teamSigningKey.GetKID())
		}
	}

	// If we didn't short circuit above, then the signing key is correct. Parse
	// the JSON and return the result.
	parsedStatement := keybase1.TeamEkStatement{}
	err = json.Unmarshal(payload, &parsedStatement)
	if err != nil {
		return nil, false, err
	}
	return &parsedStatement, false, nil
}

func filterStaleTeamEKStatement(ctx context.Context, g *libkb.GlobalContext, statement *keybase1.TeamEkStatement, merkleRoot libkb.MerkleRoot) (active []keybase1.TeamEkMetadata, err error) {
	defer g.CTrace(ctx, "filterStaleTeamEKStatement", func() error { return err })()

	if statement == nil {
		return nil, err
	}

	allMetadata := append([]keybase1.TeamEkMetadata{}, statement.ExistingTeamEkMetadata...)
	allMetadata = append(allMetadata, statement.CurrentTeamEkMetadata)
	for _, metadata := range allMetadata {
		if !ctimeIsStale(metadata.Ctime, merkleRoot) {
			active = append(active, metadata)
		}
	}

	return active, nil
}

type teamMemberEKStatementResponse struct {
	Sigs map[keybase1.UID]string `json:"sigs"`
}

// Returns nil if all team members have never published a teamEK. Verifies that
// the map of users the server returns are indeed valid team members of the
// team and all signatures verify correctly for the users.
func fetchTeamMemberStatements(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID) (statementMap map[keybase1.UID]*keybase1.UserEkStatement, err error) {
	defer g.CTrace(ctx, "fetchTeamMemberStatements", func() error { return err })()

	apiArg := libkb.APIArg{
		Endpoint:    "team/member_eks",
		SessionType: libkb.APISessionTypeREQUIRED,
		NetContext:  ctx,
		Args: libkb.HTTPArgs{
			"team_id": libkb.S{Val: string(teamID)},
		},
	}
	res, err := g.GetAPI().Get(apiArg)
	if err != nil {
		return nil, err
	}

	parsedResponse := teamMemberEKStatementResponse{}
	err = res.Body.UnmarshalAgain(&parsedResponse)
	if err != nil {
		return nil, err
	}

	team, err := teams.Load(ctx, g, keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	if err != nil {
		return nil, err
	}
	statementMap = make(map[keybase1.UID]*keybase1.UserEkStatement)
	for uid, sig := range parsedResponse.Sigs {
		// Verify the server only returns actual members of our team.
		uv, err := team.UserVersionByUID(ctx, uid)
		if err != nil {
			return nil, err
		}
		isMember := team.IsMember(ctx, uv)
		if !isMember {
			return nil, fmt.Errorf("Server lied about team membership! %v is not a member of team %v", uv, teamID)
		}
		memberStatement, wrongKID, err := verifySigWithLatestPUK(ctx, g, uid, sig)
		// Check the wrongKID condition before checking the error, since an error
		// is still returned in this case. TODO: Turn this warning into an error
		// after EK support is sufficiently widespread.
		if wrongKID {
			g.Log.CWarningf(ctx, "Member %v revoked a device without generating new ephemeral keys. They might be running an old version?", uid)
			return nil, nil
		}
		if err != nil {
			return nil, err
		}
		statementMap[uid] = memberStatement
	}
	return statementMap, nil
}
