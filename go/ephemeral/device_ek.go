package ephemeral

import (
	"context"
	"encoding/json"
	"fmt"

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

func postNewDeviceEK(ctx context.Context, g *libkb.GlobalContext, sig string) (err error) {
	defer g.CTraceTimed(ctx, "postNewDeviceEK", func() error { return err })()

	apiArg := libkb.APIArg{
		Endpoint:    "user/device_ek",
		SessionType: libkb.APISessionTypeREQUIRED,
		NetContext:  ctx,
		Args: libkb.HTTPArgs{
			"sig":       libkb.S{Val: sig},
			"device_id": libkb.S{Val: string(g.Env.GetDeviceID())},
		},
	}
	_, err = g.GetAPI().Post(apiArg)
	return err
}

func serverMaxDeviceEK(ctx context.Context, g *libkb.GlobalContext, merkleRoot libkb.MerkleRoot) (maxGeneration keybase1.EkGeneration, err error) {
	defer g.CTraceTimed(ctx, "serverMaxDeviceEK", func() error { return err })()

	deviceEKs, err := allDeviceEKMetadataMaybeStale(ctx, g, merkleRoot)
	if err != nil {
		return maxGeneration, err
	}
	deviceID := g.Env.GetDeviceID()
	metadata, ok := deviceEKs[deviceID]
	if ok {
		return metadata.Generation, nil
	}
	// We may not have an EK yet, let's try with this and fail if the server
	// rejects.
	g.Log.CDebugf(ctx, "No deviceEK found on the server")
	return 0, nil
}

func publishNewDeviceEK(ctx context.Context, g *libkb.GlobalContext, merkleRoot libkb.MerkleRoot) (metadata keybase1.DeviceEkMetadata, err error) {
	defer g.CTraceTimed(ctx, "publishNewDeviceEK", func() error { return err })()

	seed, err := newDeviceEphemeralSeed()
	if err != nil {
		return metadata, err
	}

	storage := g.GetDeviceEKStorage()
	generation, err := storage.MaxGeneration(ctx)
	if err != nil {
		// Let's try to get the max from the server
		g.Log.CDebugf(ctx, "Error getting maxGeneration from storage")
		generation, err = serverMaxDeviceEK(ctx, g, merkleRoot)
		if err != nil {
			return metadata, err
		}
	}
	// This is our first generation
	if generation < 0 {
		generation = 0
	}
	generation++

	metadata, err = signAndPostDeviceEK(ctx, g, generation, seed, merkleRoot)
	if err != nil {
		g.Log.CDebugf(ctx, "Error posting deviceEK, retrying with server maxGeneration")
		// Let's retry posting with the server given max
		generation, err = serverMaxDeviceEK(ctx, g, merkleRoot)
		if err != nil {
			return metadata, err
		}
		generation++
		metadata, err = signAndPostDeviceEK(ctx, g, generation, seed, merkleRoot)
		if err != nil {
			return metadata, err
		}
	}

	return metadata, err
}

func signAndPostDeviceEK(ctx context.Context, g *libkb.GlobalContext, generation keybase1.EkGeneration, seed DeviceEKSeed, merkleRoot libkb.MerkleRoot) (metadata keybase1.DeviceEkMetadata, err error) {
	defer g.CTraceTimed(ctx, "signAndPostDeviceEK", func() error { return err })()

	storage := g.GetDeviceEKStorage()

	// Sign the statement blob with the device's long term signing key.
	signingKey, err := g.ActiveDevice.SigningKey()
	if err != nil {
		return metadata, err
	}

	dhKeypair := seed.DeriveDHKey()
	statement, signedStatement, err := signDeviceEKStatement(generation, dhKeypair, signingKey, merkleRoot)

	metadata = statement.CurrentDeviceEkMetadata
	// Ensure we successfully write the secret to disk before posting to the
	// server since the secret never leaves the device.
	if err = storage.Put(ctx, generation, keybase1.DeviceEk{
		Seed:     keybase1.Bytes32(seed),
		Metadata: metadata,
	}); err != nil {
		return metadata, err
	}

	err = postNewDeviceEK(ctx, g, signedStatement)
	if err != nil {
		storage.ClearCache()
		serr := NewDeviceEKStorage(g).Delete(ctx, generation)
		if serr != nil {
			g.Log.CDebugf(ctx, "DeviceEK deletion failed %v", err)
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

func allDeviceEKMetadataMaybeStale(ctx context.Context, g *libkb.GlobalContext, merkleRoot libkb.MerkleRoot) (metadata map[keybase1.DeviceID]keybase1.DeviceEkMetadata, err error) {
	defer g.CTraceTimed(ctx, "allDeviceEKMetadataMaybeStale", func() error { return err })()
	m := libkb.NewMetaContext(ctx, g)

	apiArg := libkb.APIArg{
		Endpoint:    "user/device_eks",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args:        libkb.HTTPArgs{},
	}
	res, err := g.GetAPI().Get(m, apiArg)
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
	self, _, err := g.GetUPAKLoader().Load(libkb.NewLoadUserByUIDArg(ctx, g, g.Env.GetUID()))
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
		signerKey, payload, _, err := libkb.NaclVerifyAndExtract(sig)
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
func allActiveDeviceEKMetadata(ctx context.Context, g *libkb.GlobalContext, merkleRoot libkb.MerkleRoot) (metadata map[keybase1.DeviceID]keybase1.DeviceEkMetadata, err error) {
	defer g.CTraceTimed(ctx, "allActiveDeviceEKMetadata", func() error { return err })()

	maybeStale, err := allDeviceEKMetadataMaybeStale(ctx, g, merkleRoot)
	if err != nil {
		return nil, err
	}

	active := map[keybase1.DeviceID]keybase1.DeviceEkMetadata{}
	for deviceID, metadata := range maybeStale {
		// Check whether the key is stale. This isn't considered an error,
		// since the server doesn't do this check for us. We log these cases
		// and skip them.
		if ctimeIsStale(metadata.Ctime.Time(), merkleRoot) {
			g.Log.CDebugf(ctx, "skipping stale deviceEK %s for device KID %s", metadata.Kid, deviceID)
			continue
		}
		active[deviceID] = metadata
	}

	return active, nil
}
