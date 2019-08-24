package encrypteddb

import (
	"errors"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

func GetSecretBoxKey(ctx context.Context, g *libkb.GlobalContext, getSecretUI func() libkb.SecretUI,
	reason libkb.EncryptionReason, reasonStr string) (fkey [32]byte, err error) {
	// Get secret device key
	encKey, err := engine.GetMySecretKey(ctx, g, getSecretUI, libkb.DeviceEncryptionKeyType,
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

// NoSecretUI is the default SecretUI for GetSecretBoxKey, because we don't
// expect to do any interactive key unlocking there. GetSecretBoxKey should
// only be used where device key is present and unlocked.
type NoSecretUI struct {
}

func (d NoSecretUI) GetPassphrase(pinentry keybase1.GUIEntryArg, terminal *keybase1.SecretEntryArg) (keybase1.GetPassphraseRes, error) {
	return keybase1.GetPassphraseRes{}, errors.New("no secret UI available")
}

var DefaultSecretUI = func() libkb.SecretUI { return NoSecretUI{} }
