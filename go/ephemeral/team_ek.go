package ephemeral

import (
	"encoding/json"
	"fmt"

	"github.com/keybase/client/go/kbcrypto"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
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

type TeamEphemeralKeyer struct{}

var _ EphemeralKeyer = (*TeamEphemeralKeyer)(nil)

func NewTeamEphemeralKeyer() *TeamEphemeralKeyer {
	return &TeamEphemeralKeyer{}
}

func (k *TeamEphemeralKeyer) Type() keybase1.TeamEphemeralKeyType {
	return keybase1.TeamEphemeralKeyType_TEAM
}

func postNewTeamEK(mctx libkb.MetaContext, teamID keybase1.TeamID, sig string,
	boxes *[]keybase1.TeamEkBoxMetadata) (err error) {
	defer mctx.TraceTimed("postNewTeamEK", func() error { return err })()

	boxesJSON, err := json.Marshal(*boxes)
	if err != nil {
		return err
	}
	apiArg := libkb.APIArg{
		Endpoint:    "team/team_ek",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"team_id": libkb.S{Val: string(teamID)},
			"sig":     libkb.S{Val: sig},
			"boxes":   libkb.S{Val: string(boxesJSON)},
		},
	}
	_, err = mctx.G().GetAPI().Post(mctx, apiArg)
	return err
}

func prepareNewTeamEK(mctx libkb.MetaContext, teamID keybase1.TeamID,
	signingKey libkb.NaclSigningKeyPair, membersMetadata map[keybase1.UID]keybase1.UserEkMetadata,
	merkleRoot libkb.MerkleRoot) (sig string, boxes *[]keybase1.TeamEkBoxMetadata,
	metadata keybase1.TeamEkMetadata, myBox *keybase1.TeamEkBoxed, err error) {
	defer mctx.TraceTimed("prepareNewTeamEK", func() error { return err })()

	seed, err := newTeamEphemeralSeed()
	if err != nil {
		return "", nil, metadata, nil, err
	}

	prevStatement, latestGeneration, wrongKID, err := fetchTeamEKStatement(mctx, teamID)
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
	boxes, myTeamEKBoxed, err := boxTeamEKForUsers(mctx, membersMetadata, teamEK)
	if err != nil {
		return "", nil, metadata, nil, err
	}
	return sig, boxes, metadata, myTeamEKBoxed, nil
}

func publishNewTeamEK(mctx libkb.MetaContext, teamID keybase1.TeamID,
	merkleRoot libkb.MerkleRoot) (metadata keybase1.TeamEkMetadata, err error) {
	defer mctx.TraceTimed("publishNewTeamEK", func() error { return err })()

	team, err := teams.Load(mctx.Ctx(), mctx.G(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	if err != nil {
		return metadata, err
	}
	signingKey, err := team.SigningKey(mctx.Ctx())
	if err != nil {
		return metadata, err
	}

	statementMap, err := fetchTeamMemberStatements(mctx, teamID)
	if err != nil {
		return metadata, err
	}
	membersMetadata, err := activeUserEKMetadata(mctx, statementMap, merkleRoot)
	if err != nil {
		return metadata, err
	}

	sig, boxes, teamEKMetadata, myBox, err := prepareNewTeamEK(mctx, teamID, signingKey, membersMetadata, merkleRoot)
	if err != nil {
		return metadata, err
	}

	if err = postNewTeamEK(mctx, teamID, sig, boxes); err != nil {
		return metadata, err
	}

	if myBox == nil {
		mctx.Debug("No box made for own teamEK")
	} else {
		storage := mctx.G().GetTeamEKBoxStorage()
		boxed := keybase1.NewTeamEphemeralKeyBoxedWithTeam(*myBox)
		if err = storage.Put(mctx, teamID, teamEKMetadata.Generation, boxed); err != nil {
			return metadata, err
		}
	}
	return teamEKMetadata, nil
}

func (k *TeamEphemeralKeyer) Fetch(mctx libkb.MetaContext, teamID keybase1.TeamID, generation keybase1.EkGeneration, contentCtime *gregor1.Time) (teamEK keybase1.TeamEphemeralKeyBoxed, err error) {
	apiArg := libkb.APIArg{
		Endpoint:    "team/team_ek_box",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"team_id":    libkb.S{Val: string(teamID)},
			"generation": libkb.U{Val: uint64(generation)},
		},
	}

	var result TeamEKBoxedResponse
	res, err := mctx.G().GetAPI().Get(mctx, apiArg)
	if err != nil {
		err = errFromAppStatus(err)
		return teamEK, err
	}

	err = res.Body.UnmarshalAgain(&result)
	if err != nil {
		return teamEK, err
	}

	if result.Result == nil {
		err = newEKMissingBoxErr(mctx, TeamEKKind, generation)
		return teamEK, err
	}

	// Although we verify the signature is valid, it's possible that this key
	// was signed with a PTK that is not our latest and greatest. We allow this
	// when we are using this ek for *decryption*. When getting a key for
	// *encryption* callers are responsible for verifying the signature is
	// signed by the latest PTK or generating a new EK. This logic currently
	// lives in ephemeral/lib.go#GetOrCreateLatestTeamEK (#newTeamEKNeeded)
	_, teamEKStatement, err := extractTeamEKStatementFromSig(result.Result.Sig)
	if err != nil {
		return teamEK, err
	} else if teamEKStatement == nil { // shouldn't happen
		return teamEK, fmt.Errorf("unable to fetch valid teamEKStatement")
	}

	teamEKMetadata := teamEKStatement.CurrentTeamEkMetadata
	if generation != teamEKMetadata.Generation {
		// sanity check that we got the right generation
		return teamEK, newEKCorruptedErr(mctx, TeamEKKind, generation, teamEKMetadata.Generation)
	}
	teamEKBoxed := keybase1.TeamEkBoxed{
		Box:              result.Result.Box,
		UserEkGeneration: result.Result.UserEKGeneration,
		Metadata:         teamEKMetadata,
	}

	return keybase1.NewTeamEphemeralKeyBoxedWithTeam(teamEKBoxed), nil
}

func (k *TeamEphemeralKeyer) Unbox(mctx libkb.MetaContext, boxed keybase1.TeamEphemeralKeyBoxed,
	contentCtime *gregor1.Time) (ek keybase1.TeamEphemeralKey, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("TeamEKBoxStorage#unbox: teamEKGeneration: %v", boxed.Generation()),
		func() error { return err })()

	typ, err := boxed.KeyType()
	if err != nil {
		return ek, err
	}
	if !typ.IsTeam() {
		return ek, NewIncorrectTeamEphemeralKeyTypeError(typ, keybase1.TeamEphemeralKeyType_TEAM)
	}

	teamEKBoxed := boxed.Team()
	teamEKGeneration := teamEKBoxed.Metadata.Generation
	userEKBoxStorage := mctx.G().GetUserEKBoxStorage()
	userEK, err := userEKBoxStorage.Get(mctx, teamEKBoxed.UserEkGeneration, contentCtime)
	if err != nil {
		mctx.Debug("unable to get from userEKStorage %v", err)
		if _, ok := err.(EphemeralKeyError); ok {
			return ek, newEKUnboxErr(mctx, TeamEKKind, teamEKGeneration, UserEKKind,
				teamEKBoxed.UserEkGeneration, contentCtime)
		}
		return ek, err
	}

	userSeed := UserEKSeed(userEK.Seed)
	userKeypair := userSeed.DeriveDHKey()

	msg, _, err := userKeypair.DecryptFromString(teamEKBoxed.Box)
	if err != nil {
		mctx.Debug("unable to decrypt teamEKBoxed %v", err)
		return ek, newEKUnboxErr(mctx, TeamEKKind, teamEKGeneration, UserEKKind,
			teamEKBoxed.UserEkGeneration, contentCtime)
	}

	seed, err := newTeamEKSeedFromBytes(msg)
	if err != nil {
		return ek, err
	}

	keypair := seed.DeriveDHKey()
	if !keypair.GetKID().Equal(teamEKBoxed.Metadata.Kid) {
		return ek, fmt.Errorf("Failed to verify server given seed [%s] against signed KID [%s]. Box: %+v",
			teamEKBoxed.Metadata.Kid, keypair.GetKID(), teamEKBoxed)
	}

	return keybase1.NewTeamEphemeralKeyWithTeam(keybase1.TeamEk{
		Seed:     keybase1.Bytes32(seed),
		Metadata: teamEKBoxed.Metadata,
	}), nil
}

// There are plenty of race conditions where the PTK or teamEK or
// membership list can change out from under us while we're in the middle
// of posting a new key, causing the post to fail. Detect these conditions
// and retry.
func teamEKRetryWrapper(mctx libkb.MetaContext, retryFn func() error) (err error) {
	for tries := 0; tries < maxRetries; tries++ {
		if err = retryFn(); err == nil {
			return nil
		}
		if !libkb.IsEphemeralRetryableError(err) {
			return err
		}
		mctx.Debug("teamEKRetryWrapper found a retryable error on try %d: %v",
			tries, err)
		select {
		case <-mctx.Ctx().Done():
			return mctx.Ctx().Err()
		default:
			// continue retrying
		}
	}
	return err
}

func ForcePublishNewTeamEKForTesting(mctx libkb.MetaContext, teamID keybase1.TeamID,
	merkleRoot libkb.MerkleRoot) (metadata keybase1.TeamEkMetadata, err error) {
	defer mctx.TraceTimed("ForcePublishNewTeamEKForTesting", func() error { return err })()
	err = teamEKRetryWrapper(mctx, func() error {
		metadata, err = publishNewTeamEK(mctx, teamID, merkleRoot)
		return err
	})
	return metadata, err
}

func boxTeamEKForUsers(mctx libkb.MetaContext, usersMetadata map[keybase1.UID]keybase1.UserEkMetadata,
	teamEK keybase1.TeamEk) (teamBoxes *[]keybase1.TeamEkBoxMetadata, myTeamEKBoxed *keybase1.TeamEkBoxed, err error) {
	defer mctx.TraceTimed("boxTeamEKForUsers", func() error { return err })()

	myUID := mctx.G().Env.GetUID()
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
func fetchTeamEKStatement(mctx libkb.MetaContext, teamID keybase1.TeamID) (
	statement *keybase1.TeamEkStatement, latestGeneration keybase1.EkGeneration, wrongKID bool, err error) {
	defer mctx.TraceTimed("fetchTeamEKStatement", func() error { return err })()

	apiArg := libkb.APIArg{
		Endpoint:    "team/team_ek",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"team_id": libkb.S{Val: string(teamID)},
		},
	}
	res, err := mctx.G().GetAPI().Get(mctx, apiArg)
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
		mctx.Debug("team has no teamEKStatement at all")
		return nil, latestGeneration, false, nil
	}

	statement, latestGeneration, wrongKID, err = verifySigWithLatestPTK(mctx, teamID, *parsedResponse.Sig)
	// Check the wrongKID condition before checking the error, since an error
	// is still returned in this case. TODO: Turn this warning into an error
	// after EK support is sufficiently widespread.
	if wrongKID {
		mctx.Debug("It looks like someone rolled the PTK without generating new ephemeral keys. They might be on an old version.")
		return nil, latestGeneration, true, nil
	} else if err != nil {
		return nil, latestGeneration, false, err
	}

	return statement, latestGeneration, false, nil
}

func extractTeamEKStatementFromSig(sig string) (signerKey *kbcrypto.NaclSigningKeyPublic, statement *keybase1.TeamEkStatement, err error) {
	signerKey, payload, _, err := kbcrypto.NaclVerifyAndExtract(sig)
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
func verifySigWithLatestPTK(mctx libkb.MetaContext, teamID keybase1.TeamID,
	sig string) (statement *keybase1.TeamEkStatement, latestGeneration keybase1.EkGeneration, wrongKID bool, err error) {
	defer mctx.TraceTimed("verifySigWithLatestPTK", func() error { return err })()

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
	team, err := teams.Load(mctx.Ctx(), mctx.G(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	if err != nil {
		return nil, latestGeneration, false, err
	}
	teamSigningKey, err := team.SigningKey(mctx.Ctx())
	if err != nil {
		return nil, latestGeneration, false, err
	}
	if !teamSigningKey.GetKID().Equal(signerKey.GetKID()) {
		// The latest PTK might be stale. Force a reload, then check this over again.
		team, err := teams.Load(mctx.Ctx(), mctx.G(), keybase1.LoadTeamArg{
			ID:          teamID,
			ForceRepoll: true,
		})
		if err != nil {
			return nil, latestGeneration, false, err
		}
		teamSigningKey, err = team.SigningKey(mctx.Ctx())
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
func fetchTeamMemberStatements(mctx libkb.MetaContext,
	teamID keybase1.TeamID) (statements map[keybase1.UID]*keybase1.UserEkStatement, err error) {
	defer mctx.TraceTimed("fetchTeamMemberStatements", func() error { return err })()

	apiArg := libkb.APIArg{
		Endpoint:    "team/member_eks",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"team_id": libkb.S{Val: string(teamID)},
		},
	}
	res, err := mctx.G().GetAPI().Get(mctx, apiArg)
	if err != nil {
		return nil, err
	}

	memberEKStatements := teamMemberEKStatementResponse{}
	if err = res.Body.UnmarshalAgain(&memberEKStatements); err != nil {
		return nil, err
	}

	team, err := teams.Load(mctx.Ctx(), mctx.G(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	if err != nil {
		return nil, err
	}
	var uids []keybase1.UID
	for uid := range memberEKStatements.Sigs {
		uids = append(uids, uid)
	}

	getArg := func(i int) *libkb.LoadUserArg {
		if i >= len(uids) {
			return nil
		}
		tmp := libkb.NewLoadUserArgWithMetaContext(mctx).WithUID(uids[i])
		return &tmp
	}

	var upaks []*keybase1.UserPlusKeysV2AllIncarnations
	statements = make(map[keybase1.UID]*keybase1.UserEkStatement)
	processResult := func(i int, upak *keybase1.UserPlusKeysV2AllIncarnations) error {
		mctx.Debug("processing member %d/%d %.2f%% complete", i, len(uids), (float64(i) / float64(len(uids)) * 100))
		if upak == nil {
			mctx.Debug("Unable to load user %v", uids[i])
			return nil
		}
		uv := upak.Current.ToUserVersion()
		if !team.IsMember(mctx.Ctx(), uv) {
			// Team membership may be stale, force a reload and check again
			team, err = teams.Load(mctx.Ctx(), mctx.G(), keybase1.LoadTeamArg{
				ID:          teamID,
				ForceRepoll: true,
			})
			if err != nil {
				return err
			}
			if !team.IsMember(mctx.Ctx(), uv) {
				mctx.Debug("%v is not a member of team %v", uv, teamID)
				return nil
			}
		}
		upaks = append(upaks, upak)
		return nil
	}
	if err = mctx.G().GetUPAKLoader().Batcher(mctx.Ctx(), getArg, processResult, nil, 0); err != nil {
		return nil, err
	}
	for _, upak := range upaks {
		uid := upak.GetUID()
		sig, ok := memberEKStatements.Sigs[uid]
		if !ok {
			mctx.Debug("missing memberEK statement for UID %v in team %v", uid, teamID)
			continue
		}
		statement, _, wrongKID, err := verifySigWithLatestPUK(mctx, uid,
			upak.Current.GetLatestPerUserKey(), sig)
		if wrongKID {
			mctx.Debug("UID %v has a statement signed with the wrongKID, skipping", uid)
			// Don't box for this member since they have no valid userEK
			continue
		} else if err != nil {
			return nil, err
		}
		statements[uid] = statement
	}

	return statements, nil
}
