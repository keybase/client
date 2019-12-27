package ephemeral

import (
	"encoding/json"
	"fmt"

	"github.com/keybase/client/go/kbcrypto"
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
func postNewUserEK(mctx libkb.MetaContext, sig string, boxes []keybase1.UserEkBoxMetadata) (err error) {
	defer mctx.TraceTimed("postNewUserEK", func() error { return err })()

	boxesJSON, err := json.Marshal(boxes)
	if err != nil {
		return err
	}
	apiArg := libkb.APIArg{
		Endpoint:    "user/user_ek",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"sig":   libkb.S{Val: sig},
			"boxes": libkb.S{Val: string(boxesJSON)},
		},
	}
	_, err = mctx.G().GetAPI().Post(mctx, apiArg)
	return err
}

// There are two cases where we need to generate a new userEK. One is where
// we're rolling the userEK by itself, and we need to sign it with the current
// PUK. The other is where we're rolling the PUK, and we need to sign a new
// userEK with the new PUK to upload both together. This helper covers the
// steps common to both cases.
func prepareNewUserEK(mctx libkb.MetaContext, merkleRoot libkb.MerkleRoot,
	pukSigning *libkb.NaclSigningKeyPair) (sig string, boxes []keybase1.UserEkBoxMetadata,
	newMetadata keybase1.UserEkMetadata, myBox *keybase1.UserEkBoxed, err error) {
	defer mctx.TraceTimed("prepareNewUserEK", func() error { return err })()

	seed, err := newUserEphemeralSeed()
	if err != nil {
		return "", nil, newMetadata, nil, err
	}

	prevStatement, latestGeneration, wrongKID, err := fetchUserEKStatement(mctx, mctx.G().Env.GetUID())
	if !wrongKID && err != nil {
		return "", nil, newMetadata, nil, err
	}
	var newGeneration keybase1.EkGeneration
	if prevStatement == nil {
		// Even if the userEK statement was signed by the wrong key (this can
		// happen when legacy clients roll the PUK), fetchUserEKStatement will
		// return the generation number from the last (unverifiable) statement.
		// If there was never any statement, latestGeneration will be 0, so
		// adding one is correct in all cases.
		newGeneration = latestGeneration + 1
	} else {
		newGeneration = prevStatement.CurrentUserEkMetadata.Generation + 1
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

	statement := keybase1.UserEkStatement{
		CurrentUserEkMetadata: metadata,
	}
	statementJSON, err := json.Marshal(statement)
	if err != nil {
		return "", nil, newMetadata, nil, err
	}
	sig, _, err = pukSigning.SignToString(statementJSON)
	if err != nil {
		return "", nil, newMetadata, nil, err
	}

	boxes, myUserEKBoxed, err := boxUserEKForDevices(mctx, merkleRoot, seed, metadata)
	if err != nil {
		return "", nil, newMetadata, nil, err
	}

	return sig, boxes, metadata, myUserEKBoxed, nil
}

// Create a new userEK and upload it. Add our box to the local box store.
func publishNewUserEK(mctx libkb.MetaContext, merkleRoot libkb.MerkleRoot) (
	metadata keybase1.UserEkMetadata, err error) {
	defer mctx.TraceTimed("publishNewUserEK", func() error { return err })()

	// Sign the statement blob with the latest PUK.
	pukKeyring, err := mctx.G().GetPerUserKeyring(mctx.Ctx())
	if err != nil {
		return metadata, err
	}
	if err := pukKeyring.Sync(mctx); err != nil {
		return metadata, err
	}
	if !pukKeyring.HasAnyKeys() {
		return metadata, fmt.Errorf("A PUK is needed to generate ephemeral keys. Aborting.")
	}
	pukSigning, err := pukKeyring.GetLatestSigningKey(mctx)
	if err != nil {
		return metadata, err
	}

	sig, boxes, newMetadata, myBox, err := prepareNewUserEK(mctx, merkleRoot, pukSigning)
	if err != nil {
		return metadata, err
	}

	if err = postNewUserEK(mctx, sig, boxes); err != nil {
		return metadata, err
	}

	// Cache the new box after we see the post succeeded.
	if myBox == nil {
		mctx.Debug("No box made for own deviceEK")
	} else {
		storage := mctx.G().GetUserEKBoxStorage()
		err = storage.Put(mctx, newMetadata.Generation, *myBox)
	}
	return newMetadata, err
}

func ForcePublishNewUserEKForTesting(mctx libkb.MetaContext, merkleRoot libkb.MerkleRoot) (metadata keybase1.UserEkMetadata, err error) {
	defer mctx.TraceTimed("ForcePublishNewUserEKForTesting", func() error { return err })()
	return publishNewUserEK(mctx, merkleRoot)
}

func boxUserEKForDevices(mctx libkb.MetaContext, merkleRoot libkb.MerkleRoot,
	seed UserEKSeed, userMetadata keybase1.UserEkMetadata) (boxes []keybase1.UserEkBoxMetadata,
	myUserEKBoxed *keybase1.UserEkBoxed, err error) {
	defer mctx.TraceTimed("boxUserEKForDevices", func() error { return err })()

	devicesMetadata, err := allActiveDeviceEKMetadata(mctx, merkleRoot)
	if err != nil {
		return nil, nil, err
	}

	myDeviceID := mctx.ActiveDevice().DeviceID()
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
func fetchUserEKStatements(mctx libkb.MetaContext, uids []keybase1.UID) (
	statements map[keybase1.UID]*keybase1.UserEkStatement, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("fetchUserEKStatements: numUids: %v", len(uids)), func() error { return err })()

	apiArg := libkb.APIArg{
		Endpoint:    "user/get_user_ek_batch",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"uids": libkb.S{Val: libkb.UidsToString(uids)},
		},
	}
	res, err := mctx.G().GetAPI().Post(mctx, apiArg)
	if err != nil {
		return nil, err
	}

	userEKStatements := userEKStatementResponse{}
	if err = res.Body.UnmarshalAgain(&userEKStatements); err != nil {
		return nil, err
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
		upaks = append(upaks, upak)
		return nil
	}

	if err = mctx.G().GetUPAKLoader().Batcher(mctx.Ctx(), getArg, processResult, nil, 0); err != nil {
		return nil, err
	}

	for _, upak := range upaks {
		uid := upak.GetUID()
		sig, ok := userEKStatements.Sigs[uid]
		if !ok || sig == nil {
			mctx.Debug("missing memberEK statement for UID %v", uid)
			continue
		}

		statement, _, wrongKID, err := verifySigWithLatestPUK(mctx, uid,
			upak.Current.GetLatestPerUserKey(), *sig)
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

// Returns nil if the user has never published a userEK. If the user has
// published a userEK, but has since rolled their PUK without publishing a new
// one, this function will return wrongKID. This allows clients to chose the
// correct generation number but not include the statement when generating a
// new userEK.
func fetchUserEKStatement(mctx libkb.MetaContext, uid keybase1.UID) (
	statement *keybase1.UserEkStatement, latestGeneration keybase1.EkGeneration, wrongKID bool, err error) {
	defer mctx.TraceTimed("fetchUserEKStatement", func() error { return err })()

	apiArg := libkb.APIArg{
		Endpoint:    "user/user_ek",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"uids": libkb.S{Val: libkb.UidsToString([]keybase1.UID{uid})},
		},
	}
	res, err := mctx.G().GetAPI().Get(mctx, apiArg)
	if err != nil {
		return nil, latestGeneration, false, err
	}

	parsedResponse := userEKStatementResponse{}
	err = res.Body.UnmarshalAgain(&parsedResponse)
	if err != nil {
		return nil, latestGeneration, false, err
	}
	// User has no statements
	if len(parsedResponse.Sigs) == 0 {
		return nil, latestGeneration, false, nil
	}
	if len(parsedResponse.Sigs) != 1 {
		return nil, latestGeneration, false, fmt.Errorf("Invalid server response, multiple userEK statements returned")
	}
	sig, ok := parsedResponse.Sigs[uid]
	if !ok {
		return nil, latestGeneration, false, fmt.Errorf("Invalid server response, wrong uid returned")
	}

	upak, _, err := mctx.G().GetUPAKLoader().LoadV2(
		libkb.NewLoadUserArgWithMetaContext(mctx).WithUID(uid))
	if err != nil {
		return nil, latestGeneration, false, err
	}
	latestPUK := upak.Current.GetLatestPerUserKey()
	statement, latestGeneration, wrongKID, err = verifySigWithLatestPUK(mctx, uid, latestPUK, *sig)
	// Check the wrongKID condition before checking the error, since an error
	// is still returned in this case. TODO: Turn this warning into an error
	// after EK support is sufficiently widespread.
	if wrongKID {
		mctx.Debug("It looks like you revoked a device without generating new ephemeral keys. Are you running an old version?")
		return nil, latestGeneration, true, nil
	} else if err != nil {
		return nil, latestGeneration, false, err
	}

	return statement, latestGeneration, false, nil
}

func extractUserEKStatementFromSig(sig string) (signerKey *kbcrypto.NaclSigningKeyPublic, statement *keybase1.UserEkStatement, err error) {
	signerKey, payload, _, err := kbcrypto.NaclVerifyAndExtract(sig)
	if err != nil {
		return signerKey, nil, err
	}

	parsedStatement := keybase1.UserEkStatement{}
	if err = json.Unmarshal(payload, &parsedStatement); err != nil {
		return signerKey, nil, err
	}
	return signerKey, &parsedStatement, nil
}

// Verify that the blob is validly signed, and that the signing key is the
// given user's latest PUK, then parse its contents. If the blob is signed by
// the wrong KID, that's still an error, but we'll also return this special
// `wrongKID` flag. As a transitional measure while we wait for all clients in
// the wild to have EK support, callers will treat that case as "there is no
// key" and convert the error to a warning. We set `latestGeneration` so that
// callers can use this value to generate a new key even if `wrongKID` is set.
func verifySigWithLatestPUK(mctx libkb.MetaContext, uid keybase1.UID,
	latestPUK *keybase1.PerUserKey, sig string) (
	statement *keybase1.UserEkStatement, latestGeneration keybase1.EkGeneration, wrongKID bool, err error) {
	defer mctx.TraceTimed("verifySigWithLatestPUK", func() error { return err })()

	// Parse the statement before we verify the signing key. Even if the
	// signing key is bad (likely because of a legacy PUK roll that didn't
	// include a userEK statement), we'll still return the generation number.
	signerKey, parsedStatement, err := extractUserEKStatementFromSig(sig)
	if err != nil {
		return nil, latestGeneration, false, err
	}
	latestGeneration = parsedStatement.CurrentUserEkMetadata.Generation

	// Verify the signing key corresponds to the latest PUK. We use the user's
	// UPAK from cache, but if the KID doesn't match, we try a forced reload to
	// see if the cache might've been stale. Only if the KID still doesn't
	// match after the reload do we complain.
	if latestPUK == nil || !latestPUK.SigKID.Equal(signerKey.GetKID()) {
		// The latest PUK might be stale. Force a reload, then check this over again.
		upak, _, err := mctx.G().GetUPAKLoader().LoadV2(
			libkb.NewLoadUserArgWithMetaContext(mctx).WithUID(uid).WithForceReload())
		if err != nil {
			return nil, latestGeneration, false, err
		}
		latestPUK = upak.Current.GetLatestPerUserKey()
		if latestPUK == nil || !latestPUK.SigKID.Equal(signerKey.GetKID()) {
			// The latest PUK still doesn't match the signing key after a
			// forced reload. Bail out, and set the `wrongKID` flag.
			latestPUKSigningKIDString := "<nil>"
			if latestPUK != nil {
				latestPUKSigningKIDString = fmt.Sprint(latestPUK.SigKID)
			}
			err = fmt.Errorf("userEK returned for PUK signing KID %s, but latest is %s",
				signerKey.GetKID(), latestPUKSigningKIDString)
			return nil, latestGeneration, true, err
		}
	}

	return parsedStatement, latestGeneration, false, nil
}

func filterStaleUserEKStatements(mctx libkb.MetaContext, statementMap map[keybase1.UID]*keybase1.UserEkStatement,
	merkleRoot libkb.MerkleRoot) (activeMap map[keybase1.UID]keybase1.UserEkStatement, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("filterStaleUserEKStatements: numStatements: %v", len(statementMap)), func() error { return err })()

	activeMap = make(map[keybase1.UID]keybase1.UserEkStatement)
	for uid, statement := range statementMap {
		if statement == nil {
			mctx.Debug("found stale userStatement for uid: %s", uid)
			continue
		}
		metadata := statement.CurrentUserEkMetadata
		if ctimeIsStale(metadata.Ctime.Time(), merkleRoot) {
			mctx.Debug("found stale userStatement for KID: %s", metadata.Kid)
			continue
		}
		activeMap[uid] = *statement
	}

	return activeMap, nil
}

func activeUserEKMetadata(mctx libkb.MetaContext, statementMap map[keybase1.UID]*keybase1.UserEkStatement,
	merkleRoot libkb.MerkleRoot) (activeMetadata map[keybase1.UID]keybase1.UserEkMetadata, err error) {
	activeMap, err := filterStaleUserEKStatements(mctx, statementMap, merkleRoot)
	if err != nil {
		return nil, err
	}
	activeMetadata = make(map[keybase1.UID]keybase1.UserEkMetadata)
	for uid, statement := range activeMap {
		activeMetadata[uid] = statement.CurrentUserEkMetadata
	}
	return activeMetadata, nil
}
