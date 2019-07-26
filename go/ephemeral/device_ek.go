package ephemeral

import (
	"encoding/json"
	"fmt"

	"github.com/keybase/client/go/kbcrypto"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type DeviceEKSeed keybase1.Bytes32

func newDeviceEphemeralSeed() (seed DeviceEKSeed, err error) {
	randomSeed, err := makeNewRandomSeed()
	if err != nil {
		return seed, err
	}
	return DeviceEKSeed(randomSeed), nil
}

func (s *DeviceEKSeed) DeriveDHKey() *libkb.NaclDHKeyPair {
	return deriveDHKey(keybase1.Bytes32(*s), libkb.DeriveReasonDeviceEKEncryption)
}

func postNewDeviceEK(mctx libkb.MetaContext, sig string) (err error) {
	defer mctx.TraceTimed("postNewDeviceEK", func() error { return err })()

	apiArg := libkb.APIArg{
		Endpoint:    "user/device_ek",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"sig":       libkb.S{Val: sig},
			"device_id": libkb.S{Val: string(mctx.ActiveDevice().DeviceID())},
		},
	}
	_, err = mctx.G().GetAPI().Post(mctx, apiArg)
	return err
}

func serverMaxDeviceEK(mctx libkb.MetaContext, merkleRoot libkb.MerkleRoot) (maxGeneration keybase1.EkGeneration, err error) {
	defer mctx.TraceTimed("serverMaxDeviceEK", func() error { return err })()

	deviceEKs, err := allDeviceEKMetadataMaybeStale(mctx, merkleRoot)
	if err != nil {
		return maxGeneration, err
	}
	deviceID := mctx.ActiveDevice().DeviceID()
	metadata, ok := deviceEKs[deviceID]
	if ok {
		return metadata.Generation, nil
	}
	// We may not have an EK yet, let's try with this and fail if the server
	// rejects.
	mctx.Debug("No deviceEK found on the server")
	return 0, nil
}

func publishNewDeviceEK(mctx libkb.MetaContext, merkleRoot libkb.MerkleRoot) (metadata keybase1.DeviceEkMetadata, err error) {
	defer mctx.TraceTimed("publishNewDeviceEK", func() error { return err })()

	seed, err := newDeviceEphemeralSeed()
	if err != nil {
		return metadata, err
	}

	storage := mctx.G().GetDeviceEKStorage()
	generation, err := storage.MaxGeneration(mctx, true)
	if err != nil || generation < 0 {
		// Let's try to get the max from the server
		generation, err = serverMaxDeviceEK(mctx, merkleRoot)
		if err != nil {
			return metadata, err
		}
	}
	// This is our first generation
	if generation < 0 {
		generation = 0
	}
	generation++

	metadata, err = signAndPostDeviceEK(mctx, generation, seed, merkleRoot)
	if err != nil {
		mctx.Debug("Error posting deviceEK, retrying with server maxGeneration")
		// Let's retry posting with the server given max
		generation, err = serverMaxDeviceEK(mctx, merkleRoot)
		if err != nil {
			return metadata, err
		}
		generation++
		metadata, err = signAndPostDeviceEK(mctx, generation, seed, merkleRoot)
		if err != nil {
			return metadata, err
		}
	}

	return metadata, err
}

func signAndPostDeviceEK(mctx libkb.MetaContext, generation keybase1.EkGeneration,
	seed DeviceEKSeed, merkleRoot libkb.MerkleRoot) (metadata keybase1.DeviceEkMetadata, err error) {
	defer mctx.TraceTimed("signAndPostDeviceEK", func() error { return err })()

	storage := mctx.G().GetDeviceEKStorage()

	// Sign the statement blob with the device's long term signing key.
	signingKey, err := mctx.ActiveDevice().SigningKey()
	if err != nil {
		return metadata, err
	}

	dhKeypair := seed.DeriveDHKey()
	statement, signedStatement, err := signDeviceEKStatement(generation, dhKeypair, signingKey, merkleRoot)

	metadata = statement.CurrentDeviceEkMetadata
	// Ensure we successfully write the secret to disk before posting to the
	// server since the secret never leaves the device.
	if err = storage.Put(mctx, generation, keybase1.DeviceEk{
		Seed:     keybase1.Bytes32(seed),
		Metadata: metadata,
	}); err != nil {
		return metadata, err
	}

	err = postNewDeviceEK(mctx, signedStatement)
	if err != nil {
		storage.ClearCache()
		serr := NewDeviceEKStorage(mctx).Delete(mctx, generation)
		if serr != nil {
			mctx.Debug("DeviceEK deletion failed %v", err)
		}
	}

	return metadata, err
}

func signDeviceEKStatement(generation keybase1.EkGeneration, dhKeypair *libkb.NaclDHKeyPair, signingKey libkb.GenericKey, merkleRoot libkb.MerkleRoot) (statement keybase1.DeviceEkStatement, signedStatement string, err error) {
	metadata := keybase1.DeviceEkMetadata{
		Kid:        dhKeypair.GetKID(),
		Generation: generation,
		HashMeta:   merkleRoot.HashMeta(),
		// The ctime is derivable from the hash meta, by fetching the hashed
		// root from the server, but including it saves readers a potential
		// extra round trip.
		Ctime: keybase1.TimeFromSeconds(merkleRoot.Ctime()),
	}
	statement = keybase1.DeviceEkStatement{
		CurrentDeviceEkMetadata: metadata,
	}

	statementJSON, err := json.Marshal(statement)
	if err != nil {
		return statement, signedStatement, err
	}

	signedStatement, _, err = signingKey.SignToString(statementJSON)
	return statement, signedStatement, err
}

type deviceEKStatementResponse struct {
	Sigs []string `json:"sigs"`
}

func allDeviceEKMetadataMaybeStale(mctx libkb.MetaContext, merkleRoot libkb.MerkleRoot) (metadata map[keybase1.DeviceID]keybase1.DeviceEkMetadata, err error) {
	defer mctx.TraceTimed("allDeviceEKMetadataMaybeStale", func() error { return err })()

	apiArg := libkb.APIArg{
		Endpoint:    "user/device_eks",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args:        libkb.HTTPArgs{},
	}
	res, err := mctx.G().GetAPI().Get(mctx, apiArg)
	if err != nil {
		return nil, err
	}

	parsedResponse := deviceEKStatementResponse{}
	err = res.Body.UnmarshalAgain(&parsedResponse)
	if err != nil {
		return nil, err
	}

	// Make a map of the user's own active devices, by KID. We'll use this to
	// match deviceEK sigs with the device that issued them below. (Checking
	// the signing key is intentionally the only way to do this, so that we're
	// forced to check authenticity.)
	kidToDevice := map[keybase1.KID]keybase1.PublicKey{}
	self, _, err := mctx.G().GetUPAKLoader().Load(libkb.NewLoadUserArgWithMetaContext(
		mctx).WithUID(mctx.ActiveDevice().UID()))
	if err != nil {
		return nil, err
	}
	for _, device := range self.Base.DeviceKeys {
		if device.IsRevoked {
			continue
		}
		kidToDevice[device.KID] = device
	}

	// The client now needs to verify two things about these blobs its
	// received: 1) Each is validly signed. 2) The signing key belongs to one
	// of the current user's devices.
	metadata = map[keybase1.DeviceID]keybase1.DeviceEkMetadata{}
	for _, sig := range parsedResponse.Sigs {
		// Verify the sig.
		signerKey, payload, _, err := kbcrypto.NaclVerifyAndExtract(sig)
		if err != nil {
			return nil, err
		}

		// Find the device that matches the signing key. This checks
		// authenticity.
		matchingDevice, ok := kidToDevice[signerKey.GetKID()]
		if !ok {
			return nil, fmt.Errorf("deviceEK returned for unknown device KID %s", signerKey.GetKID())
		}

		// Decode the signed JSON.
		var verifiedStatement keybase1.DeviceEkStatement
		err = json.Unmarshal(payload, &verifiedStatement)
		if err != nil {
			return nil, err
		}

		metadata[matchingDevice.DeviceID] = verifiedStatement.CurrentDeviceEkMetadata
	}

	return metadata, nil
}

// allActiveDeviceEKMetadata fetches the latest deviceEK for each of your
// devices, filtering out the ones that are stale.
func allActiveDeviceEKMetadata(mctx libkb.MetaContext, merkleRoot libkb.MerkleRoot) (metadata map[keybase1.DeviceID]keybase1.DeviceEkMetadata, err error) {
	defer mctx.TraceTimed("allActiveDeviceEKMetadata", func() error { return err })()

	maybeStale, err := allDeviceEKMetadataMaybeStale(mctx, merkleRoot)
	if err != nil {
		return nil, err
	}

	active := map[keybase1.DeviceID]keybase1.DeviceEkMetadata{}
	for deviceID, metadata := range maybeStale {
		// Check whether the key is stale. This isn't considered an error,
		// since the server doesn't do this check for us. We log these cases
		// and skip them.
		if ctimeIsStale(metadata.Ctime.Time(), merkleRoot) {
			mctx.Debug("skipping stale deviceEK %s for device KID %s", metadata.Kid, deviceID)
			continue
		}
		active[deviceID] = metadata
	}

	return active, nil
}
