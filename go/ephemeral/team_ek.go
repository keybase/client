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

func (s *TeamEKSeed) DeriveDHKey() (key *libkb.NaclDHKeyPair, err error) {
	return deriveDHKey(keybase1.Bytes32(*s), libkb.DeriveReasonTeamEKEncryption)
}

type TeamEKBoxMetadata struct {
	RecipientUID        keybase1.UID          `json:"recipient_uid"`
	RecipientGeneration keybase1.EkGeneration `json:"recipient_generation"`
	Box                 string                `json:"box"`
}

func postNewTeamEK(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, sig string, boxes []TeamEKBoxMetadata) (err error) {
	defer g.CTrace(ctx, "postNewTeamEK", func() error { return err })()

	boxesJSON, err := json.Marshal(boxes)
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

func publishNewTeamEK(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, merkleRoot libkb.MerkleRoot) (metadata keybase1.TeamEkMetadata, err error) {
	defer g.CTrace(ctx, "publishNewTeamEK", func() error { return err })()

	seed, err := newTeamEphemeralSeed()
	if err != nil {
		return metadata, err
	}

	// TODO enable storage
	generation := keybase1.EkGeneration(1)
	// storage := g.GetTeamEKBoxStorage()
	// generation, err := storage.MaxGeneration(ctx, teamID)
	// if err != nil {
	// 	// Let's try to get the max from the server
	// 	g.Log.CDebugf(ctx, "Error getting maxGeneration from storage")
	// 	activeMetadata, err := teamEKMetadataMaybeStale(ctx, g, teamID)
	// 	if err != nil {
	// 		return metadata, err
	// 	}
	// 	if activeMetadata == nil {
	// 		generation = 0
	// 	} else {
	// 		generation = activeMetadata.Generation
	// 	}
	// }
	// generation++

	// metadata, myTeamEKBoxed, err := signAndPublishTeamEK(ctx, g, generation, seed, merkleRoot) TODO
	metadata, _, err = signAndPublishTeamEK(ctx, g, teamID, generation, seed, merkleRoot)
	// TODO enable max gen retry
	// if err != nil {
	// 	g.Log.CDebugf(ctx, "Error posting userEK, retrying with server maxGeneration")
	// 	// Let's retry posting with the server given max
	// 	activeMetadata, err := teamEKMetadataMaybeStale(ctx, g, teamID)
	// 	if err != nil {
	// 		return metadata, err
	// 	}
	// 	if activeMetadata == nil {
	// 		generation = 0
	// 	} else {

	// 		generation = activeMetadata.Generation
	// 	}
	// 	generation++
	// 	metadata, myTeamEKBoxed, err = signAndPublishTeamEK(ctx, g, teamID, generation, seed, merkleRoot)
	// 	if err != nil {
	// 		return metadata, err
	// 	}
	// }

	// TODO store result
	//if myTeamEKBoxed == nil {
	//	g.Log.CDebugf(ctx, "No box made for own userEK")
	//} else {
	//	err = storage.Put(ctx, teamID, generation, *myTeamEKBoxed)
	//}
	return metadata, err
}

func signAndPublishTeamEK(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, generation keybase1.EkGeneration, seed TeamEKSeed, merkleRoot libkb.MerkleRoot) (metadata keybase1.TeamEkMetadata, myTeamEKBoxed *keybase1.TeamEkBoxed, err error) {

	dhKeypair, err := seed.DeriveDHKey()
	if err != nil {
		return metadata, myTeamEKBoxed, err
	}

	metadata = keybase1.TeamEkMetadata{
		Kid:        dhKeypair.GetKID(),
		Generation: generation,
		HashMeta:   merkleRoot.HashMeta(),
		// The ctime is derivable from the hash meta, by fetching the hashed
		// root from the server, but including it saves readers a potential
		// extra round trip.
		Ctime: keybase1.TimeFromSeconds(merkleRoot.Ctime()),
	}
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return metadata, myTeamEKBoxed, err
	}

	team, err := teams.Load(ctx, g, keybase1.LoadTeamArg{
		ID: teamID,
	})
	if err != nil {
		return metadata, myTeamEKBoxed, err
	}
	teamSigningKey, err := team.SigningKey()
	if err != nil {
		return metadata, myTeamEKBoxed, err
	}

	signedPacket, _, err := teamSigningKey.SignToString(metadataJSON)
	if err != nil {
		return metadata, myTeamEKBoxed, err
	}

	boxes, myTeamEKBoxed, err := boxTeamEKForMembers(ctx, g, teamID, merkleRoot, seed, metadata)

	err = postNewTeamEK(ctx, g, teamID, signedPacket, boxes)
	if err != nil {
		return metadata, myTeamEKBoxed, err
	}

	return metadata, myTeamEKBoxed, nil
}

func boxTeamEKForMembers(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, merkleRoot libkb.MerkleRoot, seed TeamEKSeed, teamMetadata keybase1.TeamEkMetadata) (boxes []TeamEKBoxMetadata, myTeamEKBoxed *keybase1.TeamEkBoxed, err error) {
	// Box the seed up for each active userEK in the team.
	membersMetadata, err := activeTeamMemberEKMetadata(ctx, g, teamID, merkleRoot)
	if err != nil {
		return nil, nil, err
	}

	myUID := g.Env.GetUID()
	for uid, memberMetadata := range membersMetadata {
		recipientKey, err := libkb.ImportKeypairFromKID(memberMetadata.Kid)
		if err != nil {
			return nil, nil, err
		}
		// Encrypting with a nil sender means we'll generate a random sender private key.
		box, err := recipientKey.EncryptToString(seed[:], nil)
		if err != nil {
			return nil, nil, err
		}
		boxMetadata := TeamEKBoxMetadata{
			RecipientUID:        uid,
			RecipientGeneration: memberMetadata.Generation,
			Box:                 box,
		}
		boxes = append(boxes, boxMetadata)

		if uid == myUID {
			myTeamEKBoxed = &keybase1.TeamEkBoxed{
				Box:              box,
				UserEkGeneration: memberMetadata.Generation,
				Metadata:         teamMetadata,
			}
		}
	}
	return boxes, myTeamEKBoxed, err
}

type teamEKResponse struct {
	Result *ekResponse `json:"result"`
}

// Verify that the blob is validly signed, and that the signing key is the
// given team's latest PTK, then parse its contents. If the blob is signed by
// the wrong KID, that's still an error, but we'll also return this special
// `wrongKID` flag. As a transitional measure while we wait for all clients in
// the wild to have EK support, callers will treat that case as "there is no
// key" and convert the error to a warning.
func verifySigWithLatestPTK(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, sig string) (metadata *keybase1.TeamEkMetadata, wrongKID bool, err error) {
	// Verify the sig.
	signerKey, payload, _, err := libkb.NaclVerifyAndExtract(sig)
	if err != nil {
		return nil, false, err
	}

	// Verify the signing key corresponds to the latest PTK. We load the team's
	// from cache, but if the KID doesn't match, we try a forced reload to see
	// if the cache might've been stale. Only if the KID still doesn't match
	// after the reload do we complain.
	// TODO any other args to add here?
	team, err := teams.Load(ctx, g, keybase1.LoadTeamArg{
		ID: teamID,
	})
	if err != nil {
		return nil, false, err
	}
	// TODO Should we be our own team `application` instead?
	teamSigningKey, err := team.SigningKey()
	if err != nil {
		return nil, false, err
	}
	if !teamSigningKey.GetKID().Equal(signerKey.GetKID()) {
		// The latest PTK might be stale. Force a reload, then check this over again.
		team, err := teams.Load(ctx, g, keybase1.LoadTeamArg{
			ID:              teamID,
			ForceFullReload: true,
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
	parsedMetadata := keybase1.TeamEkMetadata{}
	err = json.Unmarshal(payload, &parsedMetadata)
	if err != nil {
		return nil, false, err
	}
	return &parsedMetadata, false, nil
}

// Returns nil if the team has never published a teamEK. If the team has
// published a teamEK, but has since rolled their PTK without publishing a new
// one, this function will also return nil and log a warning. This is a
// transitional thing, and eventually when all "reasonably up to date" clients
// in the wild have EK support, we will make that case an error.
func teamEKMetadataMaybeStale(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID) (metadata *keybase1.TeamEkMetadata, err error) {
	defer g.CTrace(ctx, "teamEKMetadataMaybeStale", func() error { return err })()

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

	parsedResponse := teamEKResponse{}
	err = res.Body.UnmarshalAgain(&parsedResponse)
	if err != nil {
		return nil, err
	}

	// If the result field in the response is null, the server is saying that
	// the team has never published a teamEK, stale or otherwise.
	if parsedResponse.Result == nil {
		g.Log.CDebugf(ctx, "team has no teamEK at all")
		return nil, nil
	}

	metadata, wrongKID, err := verifySigWithLatestPTK(ctx, g, teamID, parsedResponse.Result.Sig)
	// Check the wrongKID condition before checking the error, since an error
	// is still returned in this case. TODO: Turn this warning into an error
	// after EK support is sufficiently widespread.
	if wrongKID {
		g.Log.CWarningf(ctx, "It looks like you revoked a user without generating new ephemeral keys. Are you running an old version?")
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return metadata, nil
}

// As with teamEKMetadataMaybeStale, but returns nil if the latest
// metadata is stale. This checks several things:
// 1) The metadata blob is validly signed.
// 2) The signing key is the team's latest PTK.
// 3) The key hasn't expired. That is, the Merkle root it was delegated
//    with is within one week of the current root. The server deliberately
//    avoids doing this filtering for us, and finding expired keys in the
//    results here is expected. We silently drop them.
func activeTeamEKMetadata(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, merkleRoot libkb.MerkleRoot) (metadata *keybase1.TeamEkMetadata, err error) {
	defer g.CTrace(ctx, "activeTeamEKMetadata", func() error { return err })()

	metadata, err = teamEKMetadataMaybeStale(ctx, g, teamID)
	if err != nil {
		return nil, err
	}
	if metadata == nil {
		// There is no key.
		return nil, nil
	}

	// Check whether the key is expired. This isn't considered an error,
	// since the server doesn't do this check for us. We log these cases
	// and return nil.
	ageSecs := merkleRoot.Ctime() - metadata.Ctime.UnixSeconds()
	if keybase1.Time(ageSecs) > KeyLifetimeSecs {
		g.Log.CDebugf(ctx, "found stale teamEK %s", metadata.Kid)
		return nil, nil
	}

	// This key is valid and current. Return it.
	return metadata, nil
}

type memberEKresponse struct {
	ekResponse
	UID keybase1.UID `json:"uid"`
}
type teamMemberEKsResponse struct {
	Results []memberEKresponse `json:"results"`
}

func teamMemberEKMetadataMaybeStale(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID) (metadata map[keybase1.UID]*keybase1.UserEkMetadata, err error) {
	defer g.CTrace(ctx, "teamMemberEKMetadataMaybeStale", func() error { return err })()

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

	parsedResponse := teamMemberEKsResponse{}
	err = res.Body.UnmarshalAgain(&parsedResponse)
	if err != nil {
		return nil, err
	}

	metadata = make(map[keybase1.UID]*keybase1.UserEkMetadata)
	for _, res := range parsedResponse.Results {
		memberMetadata, wrongKID, err := verifySigWithLatestPUK(ctx, g, res.UID, res.Sig)
		// Check the wrongKID condition before checking the error, since an error
		// is still returned in this case. TODO: Turn this warning into an error
		// after EK support is sufficiently widespread.
		if wrongKID {
			g.Log.CWarningf(ctx, "It looks like you revoked a team member without generating new ephemeral keys. Are you running an old version?")
			return nil, nil
		}
		if err != nil {
			return nil, err
		}
		metadata[res.UID] = memberMetadata
	}
	return metadata, nil
}

func activeTeamMemberEKMetadata(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, merkleRoot libkb.MerkleRoot) (activeMetadata map[keybase1.UID]*keybase1.UserEkMetadata, err error) {
	defer g.CTrace(ctx, "activeTeamEKMetadata", func() error { return err })()

	metadata, err := teamMemberEKMetadataMaybeStale(ctx, g, teamID)
	if err != nil {
		return nil, err
	}
	if metadata == nil {
		// No team members have keys..
		return nil, nil
	}

	// Check whether the key is expired. This isn't considered an error,
	// since the server doesn't do this check for us. We log these cases
	// and return nil.
	activeMetadata = make(map[keybase1.UID]*keybase1.UserEkMetadata)
	for uid, memberMetadata := range metadata {
		ageSecs := merkleRoot.Ctime() - memberMetadata.Ctime.UnixSeconds()
		if ageSecs > KeyLifetimeSecs {
			g.Log.CDebugf(ctx, "found stale userEK %s", memberMetadata.Kid)
			continue
		}
		activeMetadata[uid] = memberMetadata
	}

	// These keys are valid and current. Return them.
	return activeMetadata, nil
}
