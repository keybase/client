package ephemeral

import (
	"bytes"
	"context"
	"crypto/sha256"
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

func (s *DeviceEKSeed) DeriveDHKey() (key *libkb.NaclDHKeyPair, err error) {
	return deriveDHKey(keybase1.Bytes32(*s), libkb.DeriveReasonDeviceEKEncryption)
}

func postNewDeviceEK(ctx context.Context, g *libkb.GlobalContext, sig string) error {
	apiArg := libkb.APIArg{
		Endpoint:    "user/device_ek",
		SessionType: libkb.APISessionTypeREQUIRED,
		NetContext:  ctx,
		Args: libkb.HTTPArgs{
			"sig":       libkb.S{Val: sig},
			"device_id": libkb.S{Val: string(g.Env.GetDeviceID())},
		},
	}
	_, err := g.GetAPI().Post(apiArg)
	return err
}

func getServerMaxDeviceEK(ctx context.Context, g *libkb.GlobalContext) (maxGeneration keybase1.EkGeneration, err error) {
	deviceEKs, err := GetActiveDeviceEKMetadata(ctx, g)
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

func PublishNewDeviceEK(ctx context.Context, g *libkb.GlobalContext) (metadata keybase1.DeviceEkMetadata, err error) {
	defer g.CTrace(ctx, "PublishNewDeviceEK", func() error { return err })()
	currentMerkleRoot, err := g.GetMerkleClient().FetchRootFromServer(ctx, libkb.EphemeralKeyMerkleFreshness)
	if err != nil {
		return metadata, err
	}

	seed, err := newDeviceEphemeralSeed()
	if err != nil {
		return metadata, err
	}

	dhKeypair, err := seed.DeriveDHKey()
	if err != nil {
		return metadata, err
	}

	storage := g.GetDeviceEKStorage()
	generation, err := storage.MaxGeneration(ctx)
	if err != nil {
		// Let's try to get the max from the server
		g.Log.CDebugf(ctx, "Error getting maxGeneration from storage")
		generation, err = getServerMaxDeviceEK(ctx, g)
		if err != nil {
			return metadata, err
		}
	}
	generation++

	metadata, err = signAndPublishDeviceEK(ctx, g, generation, dhKeypair, currentMerkleRoot)
	if err != nil {
		g.Log.CDebugf(ctx, "Error posting deviceEK, retrying with server maxGeneration")
		// Let's retry posting with the server given max
		generation, err = getServerMaxDeviceEK(ctx, g)
		if err != nil {
			return metadata, err
		}
		generation++
		metadata, err = signAndPublishDeviceEK(ctx, g, generation, dhKeypair, currentMerkleRoot)
		if err != nil {
			return metadata, err
		}
	}

	err = storage.Put(ctx, generation, keybase1.DeviceEk{
		Seed:     keybase1.Bytes32(seed),
		Metadata: metadata,
	})
	return metadata, err
}

func signAndPublishDeviceEK(ctx context.Context, g *libkb.GlobalContext, generation keybase1.EkGeneration, dhKeypair *libkb.NaclDHKeyPair, currentMerkleRoot *libkb.MerkleRoot) (metadata keybase1.DeviceEkMetadata, err error) {
	metadata = keybase1.DeviceEkMetadata{
		Kid:        dhKeypair.GetKID(),
		Generation: generation,
		HashMeta:   currentMerkleRoot.HashMeta(),
		// The ctime is derivable from the hash meta, by fetching the hashed
		// root from the server, but including it saves readers a potential
		// extra round trip.
		Ctime: keybase1.TimeFromSeconds(currentMerkleRoot.Ctime()),
	}
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return metadata, err
	}

	// Sign the metadata blob with the device's long term signing key.
	signingKey, err := g.ActiveDevice.SigningKey()
	if err != nil {
		return metadata, err
	}
	signedPacket, _, err := signingKey.SignToString(metadataJSON)
	if err != nil {
		return metadata, err
	}

	err = postNewDeviceEK(ctx, g, signedPacket)
	if err != nil {
		return metadata, err
	}

	return metadata, nil
}

type DeviceEKsResponse struct {
	Results []struct {
		MerklePayload string `json:"merkle_payload"`
		Sig           string `json:"sig"`
	} `json:"results"`
}

func GetActiveDeviceEKMetadata(ctx context.Context, g *libkb.GlobalContext) (metadata map[keybase1.DeviceID]keybase1.DeviceEkMetadata, err error) {
	defer g.CTrace(ctx, "GetActiveDeviceEKMetadata", func() error { return err })()

	apiArg := libkb.APIArg{
		Endpoint:    "user/device_eks",
		SessionType: libkb.APISessionTypeREQUIRED,
		NetContext:  ctx,
		Args:        libkb.HTTPArgs{},
	}
	res, err := g.GetAPI().Get(apiArg)
	if err != nil {
		return nil, err
	}

	parsedResponse := DeviceEKsResponse{}
	err = res.Body.UnmarshalAgain(&parsedResponse)
	if err != nil {
		return nil, err
	}

	// The client now needs to verify several things about these blobs its
	// received:
	// 1) Each is validly signed.
	// 2) The signing key belongs to one of the current user's devices.
	// 3) The merkle payload supplied by the server matches the hash that's
	//    been signed over.
	// 4) The key hasn't expired. That is, the Merkle root it was delegated
	//    with is within one week of the current root. The server deliberately
	//    avoids doing this filtering for us, and finding expired keys in the
	//    results here is expected. We silently drop them.
	currentMerkleRoot, err := g.GetMerkleClient().FetchRootFromServer(ctx, libkb.EphemeralKeyMerkleFreshness)
	if err != nil {
		return nil, err
	}
	metadata = map[keybase1.DeviceID]keybase1.DeviceEkMetadata{}
	for _, element := range parsedResponse.Results {
		// Verify the sig.
		signerKey, payload, _, err := libkb.NaclVerifyAndExtract(element.Sig)
		if err != nil {
			return nil, err
		}

		// Verify the signing key corresponds to a device.
		var matchingDevice *keybase1.PublicKey
		self, _, err := g.GetUPAKLoader().Load(libkb.NewLoadUserByUIDArg(ctx, g, g.Env.GetUID()))
		if err != nil {
			return nil, err
		}
		for _, device := range self.Base.DeviceKeys {
			if !device.KID.Equal(signerKey.GetKID()) {
				continue
			}
			if device.IsRevoked {
				return nil, fmt.Errorf("deviceEK returned for revoked device KID %s", signerKey.GetKID())
			}
			deviceDummyVar := device
			matchingDevice = &deviceDummyVar
			break
		}
		if matchingDevice == nil {
			return nil, fmt.Errorf("deviceEK returned for unknown device KID %s", signerKey.GetKID())
		}

		// Decode the signed JSON.
		var verifiedMetadata keybase1.DeviceEkMetadata
		err = json.Unmarshal(payload, &verifiedMetadata)
		if err != nil {
			return nil, err
		}

		// Check the hash of the Merkle payload, confirm it matches what was signed, and parse it.
		computedHash := sha256.Sum256([]byte(element.MerklePayload))
		if !bytes.Equal(verifiedMetadata.HashMeta, computedHash[:]) {
			return nil, fmt.Errorf("supplied merkle root doesn't match signed hash meta")
		}
		var signedMerkleRoot libkb.MerkleRootPayloadUnpacked
		err = json.Unmarshal([]byte(element.MerklePayload), &signedMerkleRoot)
		if err != nil {
			return nil, err
		}

		// Check whether the key is expired. This isn't considered an error,
		// since the server doesn't do this check for us. We log these cases
		// and skip them.
		ageSecs := keybase1.Time(currentMerkleRoot.Ctime() - signedMerkleRoot.Ctime)
		if ageSecs > KeyLifetimeSecs {
			g.Log.CDebugf(ctx, "skipping stale deviceEK %s for device KID %s", verifiedMetadata.Kid, matchingDevice.KID)
			continue
		}

		// This key is valid and current. Add it to the return set.
		metadata[matchingDevice.DeviceID] = verifiedMetadata
	}

	return metadata, nil
}
