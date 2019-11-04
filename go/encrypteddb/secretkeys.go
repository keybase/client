package encrypteddb

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

func GetSecretBoxKey(ctx context.Context, g *libkb.GlobalContext,
	reason libkb.EncryptionReason, reasonStr string) (fkey [32]byte, err error) {
	// Get secret device key
	encKey, err := engine.GetMySecretKey(ctx, g, libkb.DeviceEncryptionKeyType,
		reasonStr)
	if err != nil {
		return fkey, err
	}
	kp, ok := encKey.(libkb.NaclDHKeyPair)
	if !ok || kp.Private == nil {
		return fkey, libkb.KeyCannotDecryptError{}
	}

	// Derive symmetric key from device key
	skey, err := encKey.SecretSymmetricKey(reason)
	if err != nil {
		return fkey, err
	}

	copy(fkey[:], skey[:])
	return fkey, nil
}

func GetSecretBoxKeyWithUID(ctx context.Context, g *libkb.GlobalContext, uid keybase1.UID,
	reason libkb.EncryptionReason, reasonStr string) (fkey [32]byte, err error) {
	// Get secret device key
	encKey, err := engine.GetMySecretKeyWithUID(ctx, g, uid,
		libkb.DeviceEncryptionKeyType, reasonStr)
	if err != nil {
		return fkey, err
	}
	kp, ok := encKey.(libkb.NaclDHKeyPair)
	if !ok || kp.Private == nil {
		return fkey, libkb.KeyCannotDecryptError{}
	}

	// Derive symmetric key from device key
	skey, err := encKey.SecretSymmetricKey(reason)
	if err != nil {
		return fkey, err
	}

	copy(fkey[:], skey[:])
	return fkey, nil
}
