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

const KeyLifetimeSecs = 60 * 60 * 24 * 7 // one week

func makeNewRandomSeed() (seed keybase1.Bytes32, err error) {
	bs, err := libkb.RandBytes(32)
	if err != nil {
		return seed, err
	}
	return libkb.MakeByte32(bs), nil
}

type DeviceEKSeed keybase1.Bytes32

func newDeviceEphemeralSeed() (seed DeviceEKSeed, err error) {
	randomSeed, err := makeNewRandomSeed()
	if err != nil {
		return seed, err
	}
	return DeviceEKSeed(randomSeed), nil
}

func (s *DeviceEKSeed) DeriveDHKey() (key *libkb.NaclDHKeyPair, err error) {
	derived, err := libkb.DeriveFromSecret(*s, libkb.DeriveReasonDeviceEKEncryption)
	if err != nil {
		return nil, err
	}
	keypair, err := libkb.MakeNaclDHKeyPairFromSecret(derived)
	return &keypair, err
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

func PublishNewDeviceEK(ctx context.Context, g *libkb.GlobalContext) (data keybase1.DeviceEkMetadata, err error) {
	currentMerkleRoot, err := g.GetMerkleClient().FetchRootFromServer(ctx, libkb.EphemeralKeyMerkleFreshness)
	if err != nil {
		return data, err
	}

	deviceEKStorage := g.GetDeviceEKStorage()
	generation := deviceEKStorage.MaxGeneration(ctx) + 1

	seed, err := newDeviceEphemeralSeed()
	if err != nil {
		return data, err
	}

	dhKeypair, err := seed.DeriveDHKey()
	if err != nil {
		return data, err
	}
	metadata := keybase1.DeviceEkMetadata{
		Kid:        dhKeypair.GetKID(),
		Generation: generation,
		HashMeta:   currentMerkleRoot.HashMeta(),
	}
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return data, err
	}

	// Sign the metadata blob with the device's long term signing key.
	signingKey, err := g.ActiveDevice.SigningKey()
	if err != nil {
		return data, err
	}
	signedPacket, _, err := signingKey.SignToString(metadataJSON)

	err = postNewDeviceEK(ctx, g, signedPacket)
	if err != nil {
		return data, err
	}

	err = deviceEKStorage.Put(ctx, generation, keybase1.DeviceEk{
		Seed:       keybase1.Bytes32(seed),
		Generation: generation,
		HashMeta:   currentMerkleRoot.HashMeta(),
	})
	if err != nil {
		return data, err
	}

	return metadata, nil
}

type DeviceEKResponseElement struct {
	MerklePayload string `json:"merkle_payload"`
	Sig           string `json:"sig"`
}

type DeviceEKsResponse struct {
	Results []DeviceEKResponseElement `json:"results"`
}

func GetOwnDeviceEKs(ctx context.Context, g *libkb.GlobalContext) ([]keybase1.DeviceEkMetadata, error) {
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
	currentDeviceEKs := []keybase1.DeviceEkMetadata{}
	currentMerkleRoot, err := g.GetMerkleClient().FetchRootFromServer(ctx, libkb.EphemeralKeyMerkleFreshness)
	for _, element := range parsedResponse.Results {
		// Verify the sig.
		signerKey, payload, _, err := libkb.NaclVerifyAndExtract(element.Sig)
		if err != nil {
			return nil, err
		}

		// Verify the signing key corresponds to a device.
		var matchingDevice *keybase1.PublicKey
		self, _, err := g.GetUPAKLoader().Load(libkb.NewLoadUserByUIDArg(ctx, g, g.Env.GetUID()))
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
		var signedMetadata keybase1.DeviceEkMetadata
		err = json.Unmarshal(payload, &signedMetadata)
		if err != nil {
			return nil, err
		}

		// Check the hash of the Merkle payload, confirm it matches what was signed, and parse it.
		computedHash := sha256.Sum256([]byte(element.MerklePayload))
		if !bytes.Equal(signedMetadata.HashMeta, computedHash[:]) {
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
		ageSecs := currentMerkleRoot.Ctime() - signedMerkleRoot.Ctime
		if ageSecs > KeyLifetimeSecs {
			g.Log.Debug("skipping expired deviceEK %s for device KID %s", signedMetadata.Kid, matchingDevice.KID)
			continue
		}

		// This key is valid and current. Add it to the list we're about to return.
		currentDeviceEKs = append(currentDeviceEKs, signedMetadata)
	}

	return currentDeviceEKs, nil
}
