package storage

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

// ***
// If we change this, make sure to update libkb.EncryptionReasonChatLocalStorage as well!
// ***
const cryptoVersion = 1

func getSecretBoxKey(ctx context.Context, g *libkb.GlobalContext, getSecretUI func() libkb.SecretUI) (fkey [32]byte, err error) {
	// Get secret device key
	encKey, err := engine.GetMySecretKey(ctx, g, getSecretUI, libkb.DeviceEncryptionKeyType,
		"encrypt chat message")
	if err != nil {
		return fkey, err
	}
	kp, ok := encKey.(libkb.NaclDHKeyPair)
	if !ok || kp.Private == nil {
		return fkey, libkb.KeyCannotDecryptError{}
	}

	// Derive symmetric key from device key
	skey, err := encKey.SecretSymmetricKey(libkb.EncryptionReasonChatLocalStorage)
	if err != nil {
		return fkey, err
	}

	copy(fkey[:], skey[:])
	return fkey, nil
}
