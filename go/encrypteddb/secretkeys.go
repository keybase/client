package encrypteddb

import (
	"errors"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

func GetSecretBoxKey(ctx context.Context, g *libkb.GlobalContext,
	reason libkb.EncryptionReason, reasonStr string) (fkey [32]byte, err error) {
	// Get secret device key
	// TODO even here, defaultSecretUI may be unused.
	encKey, err := engine.GetMySecretKey(ctx, g, defaultSecretUI, libkb.DeviceEncryptionKeyType,
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
	// TODO even here, defaultSecretUI may be unused.
	encKey, err := engine.GetMySecretKeyWithUID(ctx, g, uid, defaultSecretUI,
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

// NoSecretUI is the default SecretUI for GetSecretBoxKey, because we don't
// expect to do any interactive key unlocking there. GetSecretBoxKey should
// only be used where device key is present and unlocked.
type NoSecretUI struct {
}

func (d NoSecretUI) GetPassphrase(pinentry keybase1.GUIEntryArg, terminal *keybase1.SecretEntryArg) (keybase1.GetPassphraseRes, error) {
	return keybase1.GetPassphraseRes{}, errors.New("no secret UI available")
}

var defaultSecretUI = func() libkb.SecretUI { return NoSecretUI{} }
