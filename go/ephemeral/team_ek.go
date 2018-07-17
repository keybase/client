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
	defer g.CTraceTimed(ctx, "postNewTeamEK", func() error { return err })()

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
	defer g.CTraceTimed(ctx, "prepareNewTeamEK", func() error { return err })()

	seed, err := newTeamEphemeralSeed()
	if err != nil {
		return "", nil, metadata, nil, err
	}

	prevStatement, latestGeneration, wrongKID, err := fetchTeamEKStatement(ctx, g, teamID)
	if !wrongKID && err != nil {
		return "", nil, metadata, nil, err
	}
	var generation keybase1.EkGeneration
	if prevStatement == nil {
		// Even if the teamEK statement was signed by the wrong key (this can
		// happen when legacy clients roll the PTK), fetchTeamEKStatement will
		// return the generation number from the last (unverifiable) statement.
		// If there was never any statement, latestGeneration will be 0, so
		// adding one is correct in all cases.
		generation = latestGeneration + 1
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

	statement := keybase1.TeamEkStatement{
		CurrentTeamEkMetadata: metadata,
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
	defer g.CTraceTimed(ctx, "publishNewTeamEK", func() error { return err })()

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
		g.Log.CDebugf(ctx, "No box made for own teamEK")
	} else {
		storage := g.GetTeamEKBoxStorage()
		err = storage.Put(ctx, teamID, metadata.Generation, *myBox)
		if err != nil {
			return metadata, err
		}
	}
	return metadata, nil
}

// There are plenty of race conditions where the PTK or teamEK or
// membership list can change out from under us while we're in the middle
// of posting a new key, causing the post to fail. Detect these conditions
// and retry.
func teamEKRetryWrapper(ctx context.Context, g *libkb.GlobalContext, retryFn func() error) (err error) {
	tries := 0
	maxTries := 3
	knownRaceConditions := []keybase1.StatusCode{
		keybase1.StatusCode_SCSigWrongKey,
		keybase1.StatusCode_SCSigOldSeqno,
		keybase1.StatusCode_SCEphemeralKeyBadGeneration,
		keybase1.StatusCode_SCEphemeralKeyUnexpectedBox,
		keybase1.StatusCode_SCEphemeralKeyMissingBox,
		keybase1.StatusCode_SCEphemeralKeyWrongNumberOfKeys,
	}
	for {
		tries++
		err = retryFn()
		if err != nil {
			retryableError := false
			for _, code := range knownRaceConditions {
				if libkb.IsAppStatusCode(err, code) {
					g.Log.CDebugf(ctx, "teamEKRetryWrapper found a retryable error on try %d: %s", tries, err)
					retryableError = true
					break
				}
			}
			if !retryableError || tries >= maxTries {
				return err
			}
		} else {
			return nil
		}
	}
}

func ForcePublishNewTeamEKForTesting(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, merkleRoot libkb.MerkleRoot) (metadata keybase1.TeamEkMetadata, err error) {
	defer g.CTraceTimed(ctx, "ForcePublishNewTeamEKForTesting", func() error { return err })()
	err = teamEKRetryWrapper(ctx, g, func() error {
		metadata, err = publishNewTeamEK(ctx, g, teamID, merkleRoot)
		return err
	})
	return metadata, err
}

func boxTeamEKForUsers(ctx context.Context, g *libkb.GlobalContext, usersMetadata map[keybase1.UID]keybase1.UserEkMetadata, teamEK keybase1.TeamEk) (teamBoxes *[]keybase1.TeamEkBoxMetadata, myTeamEKBoxed *keybase1.TeamEkBoxed, err error) {
	defer g.CTraceTimed(ctx, "boxTeamEKForUsers", func() error { return err })()

	myUID := g.Env.GetUID()
	boxes := make([]keybase1.TeamEkBoxMetadata, 0, len(usersMetadata))
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
		boxes = append(boxes, boxMetadata)

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
func fetchTeamEKStatement(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID) (statement *keybase1.TeamEkStatement, latestGeneration keybase1.EkGeneration, wrongKID bool, err error) {
	defer g.CTraceTimed(ctx, "fetchTeamEKStatement", func() error { return err })()
	m := libkb.NewMetaContext(ctx, g)

	apiArg := libkb.APIArg{
		Endpoint:    "team/team_ek",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"team_id": libkb.S{Val: string(teamID)},
		},
	}
	res, err := g.GetAPI().Get(m, apiArg)
	if err != nil {
		return nil, latestGeneration, false, err
	}

	parsedResponse := teamEKStatementResponse{}
	err = res.Body.UnmarshalAgain(&parsedResponse)
	if err != nil {
		return nil, latestGeneration, false, err
	}

	// If the result field in the response is null, the server is saying that
	// the team has never published a teamEKStatement, stale or otherwise.
	if parsedResponse.Sig == nil {
		g.Log.CDebugf(ctx, "team has no teamEKStatement at all")
		return nil, latestGeneration, false, nil
	}

	statement, latestGeneration, wrongKID, err = verifySigWithLatestPTK(ctx, g, teamID, *parsedResponse.Sig)
	// Check the wrongKID condition before checking the error, since an error
	// is still returned in this case. TODO: Turn this warning into an error
	// after EK support is sufficiently widespread.
	if wrongKID {
		g.Log.CDebugf(ctx, "It looks like someone rolled the PTK without generating new ephemeral keys. They might be on an old version.")
		return nil, latestGeneration, true, nil
	} else if err != nil {
		return nil, latestGeneration, false, err
	}

	return statement, latestGeneration, false, nil
}

func extractTeamEKStatementFromSig(sig string) (signerKey libkb.GenericKey, statement *keybase1.TeamEkStatement, err error) {
	signerKey, payload, _, err := libkb.NaclVerifyAndExtract(sig)
	if err != nil {
		return signerKey, nil, err
	}

	parsedStatement := keybase1.TeamEkStatement{}
	if err = json.Unmarshal(payload, &parsedStatement); err != nil {
		return signerKey, nil, err
	}
	return signerKey, &parsedStatement, nil
}

// Verify that the blob is validly signed, and that the signing key is the
// given team's latest PTK, then parse its contents. If the blob is signed by
// the wrong KID, that's still an error, but we'll also return this special
// `wrongKID` flag. As a transitional measure while we wait for all clients in
// the wild to have EK support, callers will treat that case as "there is no
// key" and convert the error to a warning.
func verifySigWithLatestPTK(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, sig string) (statement *keybase1.TeamEkStatement, latestGeneration keybase1.EkGeneration, wrongKID bool, err error) {
	defer g.CTraceTimed(ctx, "verifySigWithLatestPTK", func() error { return err })()

	// Parse the statement before we verify the signing key. Even if the
	// signing key is bad (likely because of a legacy PTK roll that didn't
	// include a teamEK statement), we'll still return the generation number.
	signerKey, parsedStatement, err := extractTeamEKStatementFromSig(sig)
	if err != nil {
		return nil, latestGeneration, false, err
	}
	latestGeneration = parsedStatement.CurrentTeamEkMetadata.Generation

	// Verify the signing key corresponds to the latest PTK. We load the team's
	// from cache, but if the KID doesn't match, we try a forced reload to see
	// if the cache might've been stale. Only if the KID still doesn't match
	// after the reload do we complain.
	team, err := teams.Load(ctx, g, keybase1.LoadTeamArg{
		ID: teamID,
	})
	if err != nil {
		return nil, latestGeneration, false, err
	}
	teamSigningKey, err := team.SigningKey()
	if err != nil {
		return nil, latestGeneration, false, err
	}
	if !teamSigningKey.GetKID().Equal(signerKey.GetKID()) {
		// The latest PTK might be stale. Force a reload, then check this over again.
		team, err := teams.Load(ctx, g, keybase1.LoadTeamArg{
			ID:          teamID,
			ForceRepoll: true,
		})
		if err != nil {
			return nil, latestGeneration, false, err
		}
		teamSigningKey, err = team.SigningKey()
		if err != nil {
			return nil, latestGeneration, false, err
		}
		if !teamSigningKey.GetKID().Equal(signerKey.GetKID()) {
			return nil, latestGeneration, true, fmt.Errorf("teamEK returned for PTK signing KID %s, but latest is %s",
				signerKey.GetKID(), teamSigningKey.GetKID())
		}
	}

	// If we didn't short circuit above, then the signing key is correct.
	// Return the parsed statement.
	return parsedStatement, latestGeneration, false, nil
}

type teamMemberEKStatementResponse struct {
	Sigs map[keybase1.UID]string `json:"sigs"`
}

// Returns nil if all team members have never published a teamEK. Verifies that
// the map of users the server returns are indeed valid team members of the
// team and all signatures verify correctly for the users.
func fetchTeamMemberStatements(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID) (statementMap map[keybase1.UID]*keybase1.UserEkStatement, err error) {
	defer g.CTraceTimed(ctx, "fetchTeamMemberStatements", func() error { return err })()
	m := libkb.NewMetaContext(ctx, g)

	apiArg := libkb.APIArg{
		Endpoint:    "team/member_eks",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"team_id": libkb.S{Val: string(teamID)},
		},
	}
	res, err := g.GetAPI().Get(m, apiArg)
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
		upak, _, err := g.GetUPAKLoader().LoadV2(libkb.NewLoadUserByUIDArg(ctx, g, uid))
		if err != nil {
			return nil, err
		}
		uv := upak.Current.ToUserVersion()
		isMember := team.IsMember(ctx, uv)
		if !isMember {
			return nil, fmt.Errorf("Server lied about team membership! %v is not a member of team %v", uv, teamID)
		}
		memberStatement, _, wrongKID, err := verifySigWithLatestPUK(ctx, g, uid, sig)
		// Check the wrongKID condition before checking the error, since an error
		// is still returned in this case. TODO: Turn this warning into an error
		// after EK support is sufficiently widespread.
		if wrongKID {
			g.Log.CDebugf(ctx, "Member %v revoked a device without generating new ephemeral keys. They might be running an old version?", uid)
			// Don't box for this member since they have no valid userEK
			continue
		} else if err != nil {
			return nil, err
		}
		statementMap[uid] = memberStatement
	}
	return statementMap, nil
}
