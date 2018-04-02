package ephemeral

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type UserEKSeed keybase1.Bytes32

func newUserEphemeralSeed() (seed UserEKSeed, err error) {
	randomSeed, err := makeNewRandomSeed()
	if err != nil {
		return seed, err
	}
	return UserEKSeed(randomSeed), nil
}

func newUserEKSeedFromBytes(b []byte) (s UserEKSeed, err error) {
	seed, err := newEKSeedFromBytes(b)
	if err != nil {
		return s, err
	}
	return UserEKSeed(seed), nil
}

func (s *UserEKSeed) DeriveDHKey() *libkb.NaclDHKeyPair {
	return deriveDHKey(keybase1.Bytes32(*s), libkb.DeriveReasonUserEKEncryption)
}

func postNewUserEK(ctx context.Context, g *libkb.GlobalContext, sig string, boxes []keybase1.UserEkBoxMetadata) (err error) {
	defer g.CTrace(ctx, "postNewUserEK", func() error { return err })()

	boxesJSON, err := json.Marshal(boxes)
	if err != nil {
		return err
	}
	apiArg := libkb.APIArg{
		Endpoint:    "user/user_ek",
		SessionType: libkb.APISessionTypeREQUIRED,
		NetContext:  ctx,
		Args: libkb.HTTPArgs{
			"sig":   libkb.S{Val: sig},
			"boxes": libkb.S{Val: string(boxesJSON)},
		},
	}
	_, err = g.GetAPI().Post(apiArg)
	return err
}

func publishNewUserEK(ctx context.Context, g *libkb.GlobalContext, merkleRoot libkb.MerkleRoot) (metadata keybase1.UserEkMetadata, err error) {
	defer g.CTrace(ctx, "publishNewUserEK", func() error { return err })()

	seed, err := newUserEphemeralSeed()
	if err != nil {
		return metadata, err
	}

	statement, err := fetchUserEKStatement(ctx, g)
	if err != nil {
		return metadata, err
	}
	var generation keybase1.EkGeneration
	if statement == nil {
		generation = 1 // start at generation 1
	} else {
		generation = statement.CurrentUserEkMetadata.Generation + 1
	}

	metadata, myUserEKBoxed, err := signAndPublishUserEK(ctx, g, generation, seed, merkleRoot, statement)
	if err != nil {
		return metadata, err
	}

	if myUserEKBoxed == nil {
		g.Log.CWarningf(ctx, "No box made for own deviceEK")
	} else {
		storage := g.GetUserEKBoxStorage()
		err = storage.Put(ctx, generation, *myUserEKBoxed)
	}
	return metadata, err
}

func signAndPublishUserEK(ctx context.Context, g *libkb.GlobalContext, generation keybase1.EkGeneration, seed UserEKSeed, merkleRoot libkb.MerkleRoot, prevStatement *keybase1.UserEkStatement) (metadata keybase1.UserEkMetadata, myUserEKBoxed *keybase1.UserEkBoxed, err error) {
	defer g.CTrace(ctx, "signAndPublishUserEK", func() error { return err })()

	dhKeypair := seed.DeriveDHKey()

	metadata = keybase1.UserEkMetadata{
		Kid:        dhKeypair.GetKID(),
		Generation: generation,
		HashMeta:   merkleRoot.HashMeta(),
		// The ctime is derivable from the hash meta, by fetching the hashed
		// root from the server, but including it saves readers a potential
		// extra round trip.
		Ctime: keybase1.TimeFromSeconds(merkleRoot.Ctime()),
	}

	// Get the list of existing userEKs to form the full statement. Make sure
	// that if it's nil, we replace it with an empty slice. Although those are
	// practically the same in Go, they get serialized to different JSON.
	existingActiveMetadata, err := filterStaleUserEKStatement(ctx, g, prevStatement, merkleRoot)
	if err != nil {
		return metadata, nil, err
	}
	if existingActiveMetadata == nil {
		existingActiveMetadata = []keybase1.UserEkMetadata{}
	}

	statement := keybase1.UserEkStatement{
		CurrentUserEkMetadata:  metadata,
		ExistingUserEkMetadata: existingActiveMetadata,
	}
	statementJSON, err := json.Marshal(statement)
	if err != nil {
		return metadata, nil, err
	}

	// Sign the statement blob with the latest PUK.
	pukKeyring, err := g.GetPerUserKeyring()
	if err != nil {
		return metadata, nil, err
	}
	signingKey, err := pukKeyring.GetLatestSigningKey(ctx)
	if err != nil {
		return metadata, nil, err
	}
	signedPacket, _, err := signingKey.SignToString(statementJSON)
	if err != nil {
		return metadata, nil, err
	}

	boxes, myUserEKBoxed, err := boxUserEKForDevices(ctx, g, merkleRoot, seed, metadata)
	if err != nil {
		return metadata, nil, err
	}

	err = postNewUserEK(ctx, g, signedPacket, boxes)
	if err != nil {
		return metadata, nil, err
	}

	return metadata, myUserEKBoxed, nil
}

func boxUserEKForDevices(ctx context.Context, g *libkb.GlobalContext, merkleRoot libkb.MerkleRoot, seed UserEKSeed, userMetadata keybase1.UserEkMetadata) (boxes []keybase1.UserEkBoxMetadata, myUserEKBoxed *keybase1.UserEkBoxed, err error) {
	defer g.CTrace(ctx, "boxUserEKForDevices", func() error { return err })()

	devicesMetadata, err := allActiveDeviceEKMetadata(ctx, g, merkleRoot)
	if err != nil {
		return nil, nil, err
	}

	myDeviceID := g.Env.GetDeviceID()
	for deviceID, deviceMetadata := range devicesMetadata {
		recipientKey, err := libkb.ImportKeypairFromKID(deviceMetadata.Kid)
		if err != nil {
			return nil, nil, err
		}
		// Encrypting with a nil sender means we'll generate a random sender private key.
		box, err := recipientKey.EncryptToString(seed[:], nil)
		if err != nil {
			return nil, nil, err
		}
		boxMetadata := keybase1.UserEkBoxMetadata{
			RecipientDeviceID:   deviceID,
			RecipientGeneration: deviceMetadata.Generation,
			Box:                 box,
		}
		boxes = append(boxes, boxMetadata)

		if deviceID == myDeviceID {
			myUserEKBoxed = &keybase1.UserEkBoxed{
				Box:                box,
				DeviceEkGeneration: deviceMetadata.Generation,
				Metadata:           userMetadata,
			}
		}
	}
	return boxes, myUserEKBoxed, nil
}

type userEKStatementResponse struct {
	Sig *string `json:"sig"`
}

// Returns nil if the user has never published a userEK. If the user has
// published a userEK, but has since rolled their PUK without publishing a new
// one, this function will also return nil and log a warning. This is a
// transitional thing, and eventually when all "reasonably up to date" clients
// in the wild have EK support, we will make that case an error.
func fetchUserEKStatement(ctx context.Context, g *libkb.GlobalContext) (statement *keybase1.UserEkStatement, err error) {
	defer g.CTrace(ctx, "fetchUserEKStatement", func() error { return err })()

	apiArg := libkb.APIArg{
		Endpoint:    "user/user_ek",
		SessionType: libkb.APISessionTypeREQUIRED,
		NetContext:  ctx,
		Args:        libkb.HTTPArgs{},
	}
	res, err := g.GetAPI().Get(apiArg)
	if err != nil {
		return nil, err
	}

	parsedResponse := userEKStatementResponse{}
	err = res.Body.UnmarshalAgain(&parsedResponse)
	if err != nil {
		return nil, err
	}

	// If the result field in the response is null, the server is saying that
	// the user has never published a userEKStatement, stale or otherwise.
	if parsedResponse.Sig == nil {
		g.Log.CDebugf(ctx, "user has no userEKStatement at all")
		return nil, nil
	}

	statement, wrongKID, err := verifySigWithLatestPUK(ctx, g, g.Env.GetUID(), *parsedResponse.Sig)
	// Check the wrongKID condition before checking the error, since an error
	// is still returned in this case. TODO: Turn this warning into an error
	// after EK support is sufficiently widespread.
	if wrongKID {
		g.Log.CWarningf(ctx, "It looks like you revoked a device without generating new ephemeral keys. Are you running an old version?")
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return statement, nil
}

// Verify that the blob is validly signed, and that the signing key is the
// given user's latest PUK, then parse its contents. If the blob is signed by
// the wrong KID, that's still an error, but we'll also return this special
// `wrongKID` flag. As a transitional measure while we wait for all clients in
// the wild to have EK support, callers will treat that case as "there is no
// key" and convert the error to a warning.
func verifySigWithLatestPUK(ctx context.Context, g *libkb.GlobalContext, uid keybase1.UID, sig string) (statement *keybase1.UserEkStatement, wrongKID bool, err error) {
	defer g.CTrace(ctx, "verifySigWithLatestPUK", func() error { return err })()

	signerKey, payload, _, err := libkb.NaclVerifyAndExtract(sig)
	if err != nil {
		return nil, false, err
	}

	// Verify the signing key corresponds to the latest PUK. We load the user's
	// UPAK from cache, but if the KID doesn't match, we try a forced reload to
	// see if the cache might've been stale. Only if the KID still doesn't
	// match after the reload do we complain.
	upak, _, err := g.GetUPAKLoader().LoadV2(libkb.NewLoadUserByUIDArg(ctx, g, uid))
	if err != nil {
		return nil, false, err
	}
	latestPUK := upak.Current.GetLatestPerUserKey()
	if latestPUK == nil || !latestPUK.SigKID.Equal(signerKey.GetKID()) {
		// The latest PUK might be stale. Force a reload, then check this over again.
		upak, _, err = g.GetUPAKLoader().LoadV2(libkb.NewLoadUserByUIDForceArg(g, uid))
		if err != nil {
			return nil, false, err
		}
		latestPUK = upak.Current.GetLatestPerUserKey()
		if latestPUK == nil || !latestPUK.SigKID.Equal(signerKey.GetKID()) {
			// The latest PUK still doesn't match the signing key after a
			// forced reload. Bail out, and set the `wrongKID` flag.
			latestPUKSigningKIDString := "<nil>"
			if latestPUK != nil {
				latestPUKSigningKIDString = fmt.Sprint(latestPUK.SigKID)
			}
			return nil, true, fmt.Errorf("userEK returned for PUK signing KID %s, but latest is %s",
				signerKey.GetKID(), latestPUKSigningKIDString)
		}
	}

	// If we didn't short circuit above, then the signing key is correct. Parse
	// the JSON and return the result.
	parsedStatement := keybase1.UserEkStatement{}
	err = json.Unmarshal(payload, &parsedStatement)
	if err != nil {
		return nil, false, err
	}
	return &parsedStatement, false, nil
}

func filterStaleUserEKStatement(ctx context.Context, g *libkb.GlobalContext, statement *keybase1.UserEkStatement, merkleRoot libkb.MerkleRoot) (active []keybase1.UserEkMetadata, err error) {
	defer g.CTrace(ctx, "filterStaleUserEKStatement", func() error { return err })()

	if statement == nil {
		return nil, err
	}

	allMetadata := append([]keybase1.UserEkMetadata{}, statement.ExistingUserEkMetadata...)
	allMetadata = append(allMetadata, statement.CurrentUserEkMetadata)
	for _, existing := range allMetadata {
		if !ctimeIsStale(existing.Ctime, merkleRoot) {
			active = append(active, existing)
		}
	}

	return active, nil
}
