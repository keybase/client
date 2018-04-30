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

// Upload a new userEK directly, when we're not adding it to a PUK or device
// transaction.
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

// There are two cases where we need to generate a new userEK. One is where
// we're rolling the userEK by itself, and we need to sign it with the current
// PUK. The other is where we're rolling the PUK, and we need to sign a new
// userEK with the new PUK to upload both together. This helper covers the
// steps common to both cases.
func prepareNewUserEK(ctx context.Context, g *libkb.GlobalContext, merkleRoot libkb.MerkleRoot, pukSigning *libkb.NaclSigningKeyPair) (sig string, boxes []keybase1.UserEkBoxMetadata, newMetadata keybase1.UserEkMetadata, myBox *keybase1.UserEkBoxed, err error) {
	seed, err := newUserEphemeralSeed()
	if err != nil {
		return "", nil, newMetadata, nil, err
	}

	prevStatements, err := fetchUserEKStatements(ctx, g, []keybase1.UID{g.Env.GetUID()})
	if err != nil {
		return "", nil, newMetadata, nil, err
	}
	var newGeneration keybase1.EkGeneration
	var existingMaybeStaleMetadata []keybase1.UserEkMetadata
	prevStatement, ok := prevStatements[g.Env.GetUID()]
	if !ok || prevStatement == nil {
		newGeneration = 1 // start at generation 1
	} else {
		newGeneration = prevStatement.CurrentUserEkMetadata.Generation + 1
		existingMaybeStaleMetadata = append(existingMaybeStaleMetadata, prevStatement.ExistingUserEkMetadata...)
		existingMaybeStaleMetadata = append(existingMaybeStaleMetadata, prevStatement.CurrentUserEkMetadata)
	}

	dhKeypair := seed.DeriveDHKey()

	metadata := keybase1.UserEkMetadata{
		Kid:        dhKeypair.GetKID(),
		Generation: newGeneration,
		HashMeta:   merkleRoot.HashMeta(),
		// The ctime is derivable from the hash meta, by fetching the hashed
		// root from the server, but including it saves readers a potential
		// extra round trip.
		Ctime: keybase1.TimeFromSeconds(merkleRoot.Ctime()),
	}

	// Filter out the still-active userEKs, those less than a week old. Make
	// sure that if there are none, we use an empty slice instead of nil.
	// Although those are practically the same in Go, they get serialized to
	// different JSON.
	existingActiveMetadata := []keybase1.UserEkMetadata{}
	for _, metadata := range existingMaybeStaleMetadata {
		if ctimeIsStale(metadata.Ctime, merkleRoot) {
			g.Log.CDebugf(ctx, "skipping stale UserEkMetadata for KID: %s", metadata.Kid)
			continue
		}
		existingActiveMetadata = append(existingActiveMetadata, metadata)
	}

	statement := keybase1.UserEkStatement{
		CurrentUserEkMetadata:  metadata,
		ExistingUserEkMetadata: existingActiveMetadata,
	}
	statementJSON, err := json.Marshal(statement)
	if err != nil {
		return "", nil, newMetadata, nil, err
	}
	sig, _, err = pukSigning.SignToString(statementJSON)
	if err != nil {
		return "", nil, newMetadata, nil, err
	}

	boxes, myUserEKBoxed, err := boxUserEKForDevices(ctx, g, merkleRoot, seed, metadata)
	if err != nil {
		return "", nil, newMetadata, nil, err
	}

	return sig, boxes, metadata, myUserEKBoxed, nil
}

// Create a new userEK and upload it. Add our box to the local box store.
func publishNewUserEK(ctx context.Context, g *libkb.GlobalContext, merkleRoot libkb.MerkleRoot) (metadata keybase1.UserEkMetadata, err error) {
	defer g.CTrace(ctx, "publishNewUserEK", func() error { return err })()

	// Sign the statement blob with the latest PUK.
	pukKeyring, err := g.GetPerUserKeyring()
	if err != nil {
		return metadata, err
	}
	pukSigning, err := pukKeyring.GetLatestSigningKey(ctx)
	if err != nil {
		return metadata, err
	}

	sig, boxes, newMetadata, myBox, err := prepareNewUserEK(ctx, g, merkleRoot, pukSigning)
	if err != nil {
		return metadata, err
	}

	err = postNewUserEK(ctx, g, sig, boxes)
	if err != nil {
		return metadata, err
	}

	// Cache the new box after we see the post succeeded.
	if myBox == nil {
		g.Log.CDebugf(ctx, "No box made for own deviceEK")
	} else {
		storage := g.GetUserEKBoxStorage()
		err = storage.Put(ctx, newMetadata.Generation, *myBox)
	}
	return newMetadata, err
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
	Sigs map[keybase1.UID]*string `json:"sigs"`
}

// Returns nil if the user has never published a userEK. If the user has
// published a userEK, but has since rolled their PUK without publishing a new
// one, this function will also return nil and log a warning. This is a
// transitional thing, and eventually when all "reasonably up to date" clients
// in the wild have EK support, we will make that case an error.
func fetchUserEKStatements(ctx context.Context, g *libkb.GlobalContext, uids []keybase1.UID) (statements map[keybase1.UID]*keybase1.UserEkStatement, err error) {
	defer g.CTrace(ctx, "fetchUserEKStatements", func() error { return err })()

	apiArg := libkb.APIArg{
		Endpoint:    "user/user_ek",
		SessionType: libkb.APISessionTypeREQUIRED,
		NetContext:  ctx,
		Args: libkb.HTTPArgs{
			"uids": libkb.S{Val: libkb.UidsToString(uids)},
		},
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

	statements = make(map[keybase1.UID]*keybase1.UserEkStatement)
	for uid, sig := range parsedResponse.Sigs {
		statement, wrongKID, err := verifySigWithLatestPUK(ctx, g, uid, *sig)
		// Check the wrongKID condition before checking the error, since an error
		// is still returned in this case. TODO: Turn this warning into an error
		// after EK support is sufficiently widespread.
		if wrongKID {
			g.Log.CDebugf(ctx, "It looks like you revoked a device without generating new ephemeral keys. Are you running an old version?")
			return nil, nil
		}
		if err != nil {
			return nil, err
		}
		statements[uid] = statement
	}

	return statements, nil
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

func filterStaleUserEKStatements(ctx context.Context, g *libkb.GlobalContext, statementMap map[keybase1.UID]*keybase1.UserEkStatement, merkleRoot libkb.MerkleRoot) (activeMap map[keybase1.UID]keybase1.UserEkStatement, err error) {
	defer g.CTrace(ctx, "filterStaleUserEKStatements", func() error { return err })()

	activeMap = make(map[keybase1.UID]keybase1.UserEkStatement)
	for uid, statement := range statementMap {
		if statement == nil {
			g.Log.CDebugf(ctx, "found stale userStatement for uid: %s", uid)
			continue
		}
		metadata := statement.CurrentUserEkMetadata
		if ctimeIsStale(metadata.Ctime, merkleRoot) {
			g.Log.CDebugf(ctx, "found stale userStatement for KID: %s", metadata.Kid)
			continue
		}
		activeMap[uid] = *statement
	}

	return activeMap, nil
}

func activeUserEKMetadata(ctx context.Context, g *libkb.GlobalContext, statementMap map[keybase1.UID]*keybase1.UserEkStatement, merkleRoot libkb.MerkleRoot) (activeMetadata map[keybase1.UID]keybase1.UserEkMetadata, err error) {
	activeMap, err := filterStaleUserEKStatements(ctx, g, statementMap, merkleRoot)
	if err != nil {
		return nil, err
	}
	activeMetadata = make(map[keybase1.UID]keybase1.UserEkMetadata)
	for uid, statement := range activeMap {
		activeMetadata[uid] = statement.CurrentUserEkMetadata
	}
	return activeMetadata, nil
}
