package teambot

import (
	"encoding/json"
	"fmt"

	"github.com/keybase/client/go/kbcrypto"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
)

const lruSize = 1000
const maxRetries = 5

type TeambotTransientKeyError struct {
	inner      error
	generation keybase1.TeambotKeyGeneration
}

func newTeambotTransientKeyError(inner error, generation keybase1.TeambotKeyGeneration) TeambotTransientKeyError {
	return TeambotTransientKeyError{
		inner:      inner,
		generation: generation,
	}
}

func (e TeambotTransientKeyError) Error() string {
	return fmt.Sprintf("TeambotTransientKeyError for generation: %d. %v", e.generation, e.inner)
}

type TeambotPermanentKeyError struct {
	inner      error
	generation keybase1.TeambotKeyGeneration
}

func newTeambotPermanentKeyError(inner error, generation keybase1.TeambotKeyGeneration) TeambotPermanentKeyError {
	return TeambotPermanentKeyError{
		inner:      inner,
		generation: generation,
	}
}

func (e TeambotPermanentKeyError) Error() string {
	return fmt.Sprintf("TeambotPermanentKeyError for generation: %d. %v", e.generation, e.inner)
}

func newTeambotSeedFromBytes(b []byte) (seed keybase1.Bytes32, err error) {
	if len(b) != libkb.NaclDHKeysize {
		err = fmt.Errorf("Wrong EkSeed len: %d != %d", len(b), libkb.NaclDHKeysize)
		return seed, err
	}
	copy(seed[:], b)
	return seed, nil
}

func deriveTeambotDHKey(seed keybase1.Bytes32) *libkb.NaclDHKeyPair {
	derived, err := libkb.DeriveFromSecret(seed, libkb.DeriveReasonTeambotKeyEncryption)
	if err != nil {
		panic("This should never fail: " + err.Error())
	}
	keypair, err := libkb.MakeNaclDHKeyPairFromSecret(derived)
	if err != nil {
		panic("This should never fail: " + err.Error())
	}
	return &keypair
}

func extractTeambotKeyMetadataFromSig(sig string) (*kbcrypto.NaclSigningKeyPublic, *keybase1.TeambotKeyMetadata, error) {
	signerKey, payload, _, err := kbcrypto.NaclVerifyAndExtract(sig)
	if err != nil {
		return signerKey, nil, err
	}

	parsedMetadata := keybase1.TeambotKeyMetadata{}
	if err = json.Unmarshal(payload, &parsedMetadata); err != nil {
		return signerKey, nil, err
	}
	return signerKey, &parsedMetadata, nil
}

// Verify that the blob is validly signed, and that the signing key is the
// given team's latest PTK, then parse its contents.
func verifyTeambotKeySigWithLatestPTK(mctx libkb.MetaContext, teamID keybase1.TeamID, sig string) (
	metadata *keybase1.TeambotKeyMetadata, wrongKID bool, err error) {
	defer mctx.TraceTimed("verifyTeambotSigWithLatestPTK", func() error { return err })()

	signerKey, metadata, err := extractTeambotKeyMetadataFromSig(sig)
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

func CurrentUserIsBot(mctx libkb.MetaContext, botUID *gregor1.UID) bool {
	return botUID != nil && botUID.Eq(gregor1.UID(mctx.ActiveDevice().UID().ToBytes()))
}

func DeleteTeambotKeyForTest(mctx libkb.MetaContext, teamID keybase1.TeamID,
	app keybase1.TeamApplication, generation keybase1.TeambotKeyGeneration) error {
	if err := deleteTeambotKeyForTest(mctx, teamID, app, int(generation), false /* isEphemeral */); err != nil {
		return err
	}
	return mctx.G().GetTeambotBotKeyer().DeleteTeambotKeyForTest(mctx, teamID, app, generation)
}

func DeleteTeambotEKForTest(mctx libkb.MetaContext, teamID keybase1.TeamID,
	generation keybase1.EkGeneration) error {
	if err := deleteTeambotKeyForTest(mctx, teamID, keybase1.TeamApplication_CHAT, int(generation), true /* isEphemeral */); err != nil {
		return err
	}
	return mctx.G().GetTeambotEKBoxStorage().Delete(mctx, teamID, generation)
}

func deleteTeambotKeyForTest(mctx libkb.MetaContext, teamID keybase1.TeamID,
	app keybase1.TeamApplication, generation int, isEphemeral bool) error {
	apiArg := libkb.APIArg{
		Endpoint:    "teambot/delete_for_test",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"team_id":      libkb.S{Val: string(teamID)},
			"application":  libkb.I{Val: int(app)},
			"generation":   libkb.U{Val: uint64(generation)},
			"is_ephemeral": libkb.B{Val: isEphemeral},
		},
	}
	_, err := mctx.G().GetAPI().Post(mctx, apiArg)
	return err
}
