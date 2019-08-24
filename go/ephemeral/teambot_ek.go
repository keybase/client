package ephemeral

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/json"
	"fmt"

	"github.com/keybase/client/go/kbcrypto"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teambot"
	"github.com/keybase/client/go/teams"
)

type TeambotEKSeed keybase1.Bytes32

func (s *TeambotEKSeed) DeriveDHKey() *libkb.NaclDHKeyPair {
	return deriveDHKey(keybase1.Bytes32(*s), libkb.DeriveReasonTeambotEKEncryption)
}

func deriveTeambotEKFromTeamEK(mctx libkb.MetaContext, teamEK keybase1.TeamEk, botUID keybase1.UID) TeambotEKSeed {
	hasher := hmac.New(sha256.New, teamEK.Seed[:])
	_, _ = hasher.Write(botUID.ToBytes())
	_, _ = hasher.Write([]byte(libkb.EncryptionReasonTeambotEphemeralKey))
	return TeambotEKSeed(libkb.MakeByte32(hasher.Sum(nil)))
}

func newTeambotEKSeedFromBytes(b []byte) (s TeambotEKSeed, err error) {
	seed, err := newEKSeedFromBytes(b)
	if err != nil {
		return s, err
	}
	return TeambotEKSeed(seed), nil
}

type TeambotEphemeralKeyer struct{}

var _ EphemeralKeyer = (*TeambotEphemeralKeyer)(nil)

func NewTeambotEphemeralKeyer() *TeambotEphemeralKeyer {
	return &TeambotEphemeralKeyer{}
}

func (k *TeambotEphemeralKeyer) Type() keybase1.TeamEphemeralKeyType {
	return keybase1.TeamEphemeralKeyType_TEAMBOT
}

func publishNewTeambotEK(mctx libkb.MetaContext, teamID keybase1.TeamID, botUID keybase1.UID,
	teamEK keybase1.TeamEk, merkleRoot libkb.MerkleRoot) (metadata keybase1.TeambotEkMetadata, err error) {
	defer mctx.TraceTimed("publishNewTeambotEK", func() error { return err })()

	team, err := teams.Load(mctx.Ctx(), mctx.G(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	if err != nil {
		return metadata, err
	}

	sig, box, err := prepareNewTeambotEK(mctx, team, botUID, teamEK, merkleRoot)
	if err != nil {
		return metadata, err
	}

	if err = postNewTeambotEK(mctx, team.ID, sig, box.Box); err != nil {
		return metadata, err
	}

	return box.Metadata, nil
}

func postNewTeambotEK(mctx libkb.MetaContext, teamID keybase1.TeamID, sig, box string) (err error) {
	defer mctx.TraceTimed("postNewTeambotEK", func() error { return err })()

	apiArg := libkb.APIArg{
		Endpoint:    "teambot/key",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"team_id":      libkb.S{Val: string(teamID)},
			"sig":          libkb.S{Val: sig},
			"box":          libkb.S{Val: box},
			"is_ephemeral": libkb.B{Val: true},
		},
		AppStatusCodes: []int{libkb.SCOk, libkb.SCTeambotKeyGenerationExists},
	}
	_, err = mctx.G().GetAPI().Post(mctx, apiArg)
	return err
}

func prepareNewTeambotEK(mctx libkb.MetaContext, team *teams.Team, botUID keybase1.UID,
	teamEK keybase1.TeamEk, merkleRoot libkb.MerkleRoot) (sig string, box *keybase1.TeambotEkBoxed, err error) {
	defer mctx.TraceTimed("prepareNewTeambotEK", func() error { return err })()

	statement, _, _, err := fetchUserEKStatement(mctx, botUID)
	if err != nil {
		return "", nil, err
	}
	activeMetadataMap, err := activeUserEKMetadata(mctx, map[keybase1.UID]*keybase1.UserEkStatement{botUID: statement}, merkleRoot)
	if err != nil {
		return "", nil, err
	} else if len(activeMetadataMap) == 0 {
		return "", nil, fmt.Errorf("unable to make teambot key, bot has no active user EKs")
	}
	activeMetadata := activeMetadataMap[botUID]

	recipientKey, err := libkb.ImportKeypairFromKID(activeMetadata.Kid)
	if err != nil {
		return "", nil, err
	}

	seed := deriveTeambotEKFromTeamEK(mctx, teamEK, botUID)
	metadata := keybase1.TeambotEkMetadata{
		Kid:              seed.DeriveDHKey().GetKID(),
		Generation:       teamEK.Metadata.Generation,
		Uid:              botUID,
		UserEkGeneration: activeMetadata.Generation,
		HashMeta:         merkleRoot.HashMeta(),
		// The ctime is derivable from the hash meta, by fetching the hashed
		// root from the server, but including it saves readers a potential
		// extra round trip.
		Ctime: keybase1.TimeFromSeconds(merkleRoot.Ctime()),
	}

	// Encrypting with a nil sender means we'll generate a random sender
	// private key.
	boxedSeed, err := recipientKey.EncryptToString(seed[:], nil)
	if err != nil {
		return "", nil, err
	}

	boxed := keybase1.TeambotEkBoxed{
		Box:      boxedSeed,
		Metadata: metadata,
	}

	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return "", nil, err
	}

	signingKey, err := team.SigningKey(mctx.Ctx())
	if err != nil {
		return "", nil, err
	}
	sig, _, err = signingKey.SignToString(metadataJSON)
	if err != nil {
		return "", nil, err
	}
	return sig, &boxed, nil
}

func fetchLatestTeambotEK(mctx libkb.MetaContext, teamID keybase1.TeamID) (metadata *keybase1.TeambotEkMetadata, wrongKID bool, err error) {
	defer mctx.TraceTimed("fetchLatestTeambotEK", func() error { return err })()

	apiArg := libkb.APIArg{
		Endpoint:    "teambot/key",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"team_id":      libkb.S{Val: string(teamID)},
			"is_ephemeral": libkb.B{Val: true},
		},
	}
	res, err := mctx.G().GetAPI().Get(mctx, apiArg)
	if err != nil {
		return nil, false, err
	}

	var parsedResponse teambot.TeambotKeyResponse
	if err = res.Body.UnmarshalAgain(&parsedResponse); err != nil {
		return nil, false, err
	}
	if parsedResponse.Result == nil {
		return nil, false, nil
	}

	return verifyTeambotSigWithLatestPTK(mctx, teamID, parsedResponse.Result.Sig)
}

func extractTeambotEKMetadataFromSig(sig string) (*kbcrypto.NaclSigningKeyPublic, *keybase1.TeambotEkMetadata, error) {
	signerKey, payload, _, err := kbcrypto.NaclVerifyAndExtract(sig)
	if err != nil {
		return signerKey, nil, err
	}

	parsedMetadata := keybase1.TeambotEkMetadata{}
	if err = json.Unmarshal(payload, &parsedMetadata); err != nil {
		return signerKey, nil, err
	}
	return signerKey, &parsedMetadata, nil
}

// Verify that the blob is validly signed, and that the signing key is the
// given team's latest PTK, then parse its contents.
func verifyTeambotSigWithLatestPTK(mctx libkb.MetaContext, teamID keybase1.TeamID, sig string) (
	metadata *keybase1.TeambotEkMetadata, wrongKID bool, err error) {
	defer mctx.TraceTimed("verifyTeambotSigWithLatestPTK", func() error { return err })()

	signerKey, metadata, err := extractTeambotEKMetadataFromSig(sig)
	if err != nil {
		return nil, false, err
	}

	team, err := teams.Load(mctx.Ctx(), mctx.G(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	if err != nil {
		return nil, false, err
	}

	// Verify the signing key corresponds to the latest PTK. We load the team's
	// from cache, but if the KID doesn't match, we try a forced reload to see
	// if the cache might've been stale. Only if the KID still doesn't match
	// after the reload do we complain.
	teamSigningKID, err := team.SigningKID(mctx.Ctx())
	if err != nil {
		return nil, false, err
	}
	if !teamSigningKID.Equal(signerKey.GetKID()) {
		// The latest PTK might be stale. Force a reload, then check this over again.
		team, err := teams.Load(mctx.Ctx(), mctx.G(), keybase1.LoadTeamArg{
			ID:          team.ID,
			ForceRepoll: true,
		})
		if err != nil {
			return nil, false, err
		}
		teamSigningKID, err = team.SigningKID(mctx.Ctx())
		if err != nil {
			return nil, false, err
		}
		// return the metdata with wrongKID=true
		if !teamSigningKID.Equal(signerKey.GetKID()) {
			return metadata, true, fmt.Errorf("teambotEK returned for PTK signing KID %s, but latest is %s",
				signerKey.GetKID(), teamSigningKID)
		}
	}

	// If we didn't short circuit above, then the signing key is correct.
	return metadata, false, nil
}

func (k *TeambotEphemeralKeyer) Unbox(mctx libkb.MetaContext, boxed keybase1.TeamEphemeralKeyBoxed,
	contentCtime *gregor1.Time) (ek keybase1.TeamEphemeralKey, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("TeambotEphemeralKeyer#Unbox: teambotEKGeneration: %v", boxed.Generation()), func() error { return err })()

	typ, err := boxed.KeyType()
	if err != nil {
		return ek, err
	}
	if !typ.IsTeambot() {
		return ek, NewIncorrectTeamEphemeralKeyTypeError(typ, keybase1.TeamEphemeralKeyType_TEAMBOT)
	}

	teambotEKBoxed := boxed.Teambot()
	teambotEKGeneration := teambotEKBoxed.Metadata.Generation
	userEKBoxStorage := mctx.G().GetUserEKBoxStorage()
	userEK, err := userEKBoxStorage.Get(mctx, teambotEKBoxed.Metadata.UserEkGeneration, contentCtime)
	if err != nil {
		mctx.Debug("unable to get from userEKStorage %v", err)
		if _, ok := err.(EphemeralKeyError); ok {
			return ek, newEKUnboxErr(mctx, TeambotEKKind, teambotEKGeneration, UserEKKind,
				teambotEKBoxed.Metadata.UserEkGeneration, contentCtime)
		}
		return ek, err
	}

	userSeed := UserEKSeed(userEK.Seed)
	userKeypair := userSeed.DeriveDHKey()

	msg, _, err := userKeypair.DecryptFromString(teambotEKBoxed.Box)
	if err != nil {
		mctx.Debug("unable to decrypt teambotEKBoxed %v", err)
		return ek, newEKUnboxErr(mctx, TeambotEKKind, teambotEKGeneration, UserEKKind,
			teambotEKBoxed.Metadata.UserEkGeneration, contentCtime)
	}

	seed, err := newTeambotEKSeedFromBytes(msg)
	if err != nil {
		return ek, err
	}

	keypair := seed.DeriveDHKey()
	if !keypair.GetKID().Equal(teambotEKBoxed.Metadata.Kid) {
		return ek, fmt.Errorf("Failed to verify server given seed against signed KID %s", teambotEKBoxed.Metadata.Kid)
	}

	return keybase1.NewTeamEphemeralKeyWithTeambot(keybase1.TeambotEk{
		Seed:     keybase1.Bytes32(seed),
		Metadata: teambotEKBoxed.Metadata,
	}), nil
}

func (k *TeambotEphemeralKeyer) Fetch(mctx libkb.MetaContext, teamID keybase1.TeamID, generation keybase1.EkGeneration,
	contentCtime *gregor1.Time) (teambotEK keybase1.TeamEphemeralKeyBoxed, err error) {
	apiArg := libkb.APIArg{
		Endpoint:    "teambot/box",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"team_id":      libkb.S{Val: string(teamID)},
			"generation":   libkb.U{Val: uint64(generation)},
			"is_ephemeral": libkb.B{Val: true},
		},
	}

	var resp teambot.TeambotKeyBoxedResponse
	res, err := mctx.G().GetAPI().Get(mctx, apiArg)
	if err != nil {
		err = errFromAppStatus(err)
		return teambotEK, err
	}

	if err = res.Body.UnmarshalAgain(&resp); err != nil {
		return teambotEK, err
	}

	if resp.Result == nil {
		err = newEKMissingBoxErr(mctx, TeambotEKKind, generation)
		return teambotEK, err
	}

	// Although we verify the signature is valid, it's possible that this key
	// was signed with a PTK that is not our latest and greatest. We allow this
	// when we are using this ek for *decryption*. When getting a key for
	// *encryption* callers are responsible for verifying the signature is
	// signed by the latest PTK or requesting the generation of a new EK. This
	// logic currently lives in ephemeral/lib.go#getLatestTeambotEK
	_, metadata, err := extractTeambotEKMetadataFromSig(resp.Result.Sig)
	if err != nil {
		return teambotEK, err
	} else if metadata == nil { // shouldn't happen
		return teambotEK, fmt.Errorf("unable to fetch valid teambotEKMetadata")
	}

	if generation != metadata.Generation {
		// sanity check that we got the right generation
		return teambotEK, newEKCorruptedErr(mctx, TeambotEKKind, generation, metadata.Generation)
	}
	teambotEKBoxed := keybase1.TeambotEkBoxed{
		Box:      resp.Result.Box,
		Metadata: *metadata,
	}
	return keybase1.NewTeamEphemeralKeyBoxedWithTeambot(teambotEKBoxed), nil
}
