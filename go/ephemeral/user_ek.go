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

type UserEKBoxMetadata struct {
	RecipientDeviceID   keybase1.DeviceID     `json:"recipient_device_id"`
	RecipientGeneration keybase1.EkGeneration `json:"recipient_generation"`
	Box                 string                `json:"box"`
}

func postNewUserEK(ctx context.Context, g *libkb.GlobalContext, sig string, boxes []UserEKBoxMetadata) (err error) {
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

	storage := g.GetUserEKBoxStorage()
	generation, err := storage.MaxGeneration(ctx)
	if err != nil {
		// Let's try to get the max from the server
		g.Log.CDebugf(ctx, "Error getting maxGeneration from storage")
		activeMetadata, err := getLatestUserEKMetadataMaybeStale(ctx, g)
		if err != nil {
			return metadata, err
		}
		if activeMetadata == nil {
			generation = 0
		} else {
			generation = activeMetadata.Generation
		}
	}
	generation++

	metadata, myUserEKBoxed, err := signAndPublishUserEK(ctx, g, generation, seed, merkleRoot)
	if err != nil {
		g.Log.CDebugf(ctx, "Error posting deviceEK, retrying with server maxGeneration")
		// Let's retry posting with the server given max
		activeMetadata, err := getLatestUserEKMetadataMaybeStale(ctx, g)
		if err != nil {
			return metadata, err
		}
		if activeMetadata == nil {
			generation = 0
		} else {
			generation = activeMetadata.Generation
		}
		generation++
		metadata, myUserEKBoxed, err = signAndPublishUserEK(ctx, g, generation, seed, merkleRoot)
		if err != nil {
			return metadata, err
		}
	}

	if myUserEKBoxed == nil {
		g.Log.CDebugf(ctx, "No box made for own deviceEK")
	} else {
		err = storage.Put(ctx, generation, *myUserEKBoxed)
	}
	return metadata, err
}

func signAndPublishUserEK(ctx context.Context, g *libkb.GlobalContext, generation keybase1.EkGeneration, seed UserEKSeed, merkleRoot libkb.MerkleRoot) (metadata keybase1.UserEkMetadata, myUserEKBoxed *keybase1.UserEkBoxed, err error) {

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
	existing, err := getAllActiveUserEKs(ctx, g, merkleRoot)
	if err != nil {
		return metadata, myUserEKBoxed, err
	}
	if existing == nil {
		existing = []keybase1.UserEkMetadata{}
	}

	statement := keybase1.UserEkMetadataStatement{
		CurrentUserEkMetadata:   metadata,
		ExistingUserEkMetatdata: existing,
	}
	statementJSON, err := json.Marshal(statement)
	if err != nil {
		return metadata, myUserEKBoxed, err
	}

	// Sign the statement blob with the latest PUK.
	pukKeyring, err := g.GetPerUserKeyring()
	if err != nil {
		return metadata, myUserEKBoxed, err
	}
	signingKey, err := pukKeyring.GetLatestSigningKey(ctx)
	if err != nil {
		return metadata, myUserEKBoxed, err
	}
	signedPacket, _, err := signingKey.SignToString(statementJSON)
	if err != nil {
		return metadata, myUserEKBoxed, err
	}

	// Box the seed up for each active deviceEK.
	deviceEKs, err := getAllActiveDeviceEKMetadata(ctx, g, merkleRoot)
	if err != nil {
		return metadata, myUserEKBoxed, err
	}

	myDeviceID := g.Env.GetDeviceID()
	boxes := []UserEKBoxMetadata{}
	for deviceID, deviceEK := range deviceEKs {
		recipientDeviceEKKey, err := libkb.ImportKeypairFromKID(deviceEK.Kid)
		if err != nil {
			return metadata, myUserEKBoxed, err
		}
		// Encrypting with a nil sender means we'll generate a random sender private key.
		box, err := recipientDeviceEKKey.EncryptToString(seed[:], nil)
		if err != nil {
			return metadata, myUserEKBoxed, err
		}
		boxMetadata := UserEKBoxMetadata{
			RecipientDeviceID:   deviceID,
			RecipientGeneration: deviceEK.Generation,
			Box:                 box,
		}
		boxes = append(boxes, boxMetadata)

		if deviceID == myDeviceID {
			myUserEKBoxed = &keybase1.UserEkBoxed{
				Box:                box,
				DeviceEkGeneration: deviceEK.Generation,
				Metadata:           metadata,
			}
		}
	}

	err = postNewUserEK(ctx, g, signedPacket, boxes)
	if err != nil {
		return metadata, myUserEKBoxed, err
	}

	return metadata, myUserEKBoxed, nil
}

type userEKResponse struct {
	Sig *string `json:"sig"`
}

// Verify that the blob is validly signed, and that the signing key is the
// given user's latest PUK, then parse its contents. If the blob is signed by
// the wrong KID, that's still an error, but we'll also return this special
// `wrongKID` flag. As a transitional measure while we wait for all clients in
// the wild to have EK support, callers will treat that case as "there is no
// key" and convert the error to a warning.
func verifySigWithLatestPUK(ctx context.Context, g *libkb.GlobalContext, sig string) (statement *keybase1.UserEkMetadataStatement, wrongKID bool, err error) {
	// Verify the sig.
	signerKey, payload, _, err := libkb.NaclVerifyAndExtract(sig)
	if err != nil {
		return nil, false, err
	}

	// Verify the signing key corresponds to the latest PUK. We load the user's
	// UPAK from cache, but if the KID doesn't match, we try a forced reload to
	// see if the cache might've been stale. Only if the KID still doesn't
	// match after the reload do we complain.
	upak, _, err := g.GetUPAKLoader().LoadV2(libkb.NewLoadUserByUIDArg(ctx, g, g.Env.GetUID()))
	if err != nil {
		return nil, false, err
	}
	latestPUK := upak.Current.GetLatestPerUserKey()
	if latestPUK == nil || !latestPUK.SigKID.Equal(signerKey.GetKID()) {
		// The latest PUK might be stale. Force a reload, then check this over again.
		upak, _, err = g.GetUPAKLoader().LoadV2(libkb.NewLoadUserByUIDForceArg(g, g.Env.GetUID()))
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
	parsedStatement := keybase1.UserEkMetadataStatement{}
	err = json.Unmarshal(payload, &parsedStatement)
	if err != nil {
		return nil, false, err
	}
	return &parsedStatement, false, nil
}

// Returns nil if the user has never published a userEK. If the user has
// published a userEK, but has since rolled their PUK without publishing a new
// one, this function will also return nil and log a warning. This is a
// transitional thing, and eventually when all "reasonably up to date" clients
// in the wild have EK support, we will make that case an error.
func getLatestUserEKStatementMaybeStale(ctx context.Context, g *libkb.GlobalContext) (statement *keybase1.UserEkMetadataStatement, err error) {
	defer g.CTrace(ctx, "getLatestUserEKStatementMaybeStale", func() error { return err })()

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

	parsedResponse := userEKResponse{}
	err = res.Body.UnmarshalAgain(&parsedResponse)
	if err != nil {
		return nil, err
	}

	// If the result field in the response is null, the server is saying that
	// the user has never published a userEK, stale or otherwise.
	if parsedResponse.Sig == nil {
		g.Log.CDebugf(ctx, "user has no userEK at all")
		return nil, nil
	}

	statement, wrongKID, err := verifySigWithLatestPUK(ctx, g, *parsedResponse.Sig)
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

func getLatestUserEKMetadataMaybeStale(ctx context.Context, g *libkb.GlobalContext) (metadata *keybase1.UserEkMetadata, err error) {
	defer g.CTrace(ctx, "getLatestUserEKMetadataMaybeStale", func() error { return err })()

	statement, err := getLatestUserEKStatementMaybeStale(ctx, g)
	if err != nil || statement == nil {
		return nil, err
	}

	return &statement.CurrentUserEkMetadata, nil
}

func getAllActiveUserEKs(ctx context.Context, g *libkb.GlobalContext, merkleRoot libkb.MerkleRoot) (metadata []keybase1.UserEkMetadata, err error) {
	defer g.CTrace(ctx, "getAllActiveUserEKs", func() error { return err })()

	statement, err := getLatestUserEKStatementMaybeStale(ctx, g)
	if err != nil || statement == nil {
		return nil, err
	}

	allExisting := append([]keybase1.UserEkMetadata{}, statement.ExistingUserEkMetatdata...)
	allExisting = append(allExisting, statement.CurrentUserEkMetadata)
	allActive := []keybase1.UserEkMetadata{}
	for _, existing := range allExisting {
		if !ctimeIsStale(existing.Ctime, merkleRoot) {
			allActive = append(allActive, existing)
		}
	}

	return allActive, nil
}

// As with getLatestUserEKMetadataMaybeStale, but returns nil if the latest
// metadata is stale. This checks several things:
// 1) The metadata blob is validly signed.
// 2) The signing key is the user's latest PUK.
// 3) The key isn't stale . That is, the Merkle root it was delegated
//    with is within one week of the current root. The server deliberately
//    avoids doing this filtering for us, and finding stale keys in the
//    results here is expected. We silently drop them.
func getActiveUserEKMetadata(ctx context.Context, g *libkb.GlobalContext, merkleRoot libkb.MerkleRoot) (metadata *keybase1.UserEkMetadata, err error) {
	defer g.CTrace(ctx, "GetActiveUserEKMetadata", func() error { return err })()

	statement, err := getLatestUserEKStatementMaybeStale(ctx, g)
	if err != nil || statement == nil {
		return nil, err
	}

	if ctimeIsStale(statement.CurrentUserEkMetadata.Ctime, merkleRoot) {
		return nil, nil
	}

	return &statement.CurrentUserEkMetadata, nil
}
