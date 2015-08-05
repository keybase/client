package libkbfs

import (
	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/net/context"
)

// KeyOpsStandard implements the KeyOps interface and relays get/put
// requests for server-side key halves from/to the key server.
type KeyOpsStandard struct {
	config Config
}

// Test that KeyOps standard fully implements the KeyOps interface.
var _ KeyOps = (*KeyOpsStandard)(nil)

// GetTLFCryptKeyServerHalf is an implementation of the KeyOps interface.
func (k *KeyOpsStandard) GetTLFCryptKeyServerHalf(ctx context.Context,
	serverHalfID TLFCryptKeyServerHalfID) (TLFCryptKeyServerHalf, error) {
	// get the key half from the server
	serverHalf, err := k.config.KeyServer().GetTLFCryptKeyServerHalf(ctx, serverHalfID)
	if err != nil {
		return TLFCryptKeyServerHalf{}, err
	}
	// get current user and deviceKID
	user, err := k.config.KBPKI().GetLoggedInUser(ctx)
	if err != nil {
		return TLFCryptKeyServerHalf{}, err
	}
	key, err := k.config.KBPKI().GetCurrentCryptPublicKey(ctx)
	if err != nil {
		return TLFCryptKeyServerHalf{}, err
	}

	// verify we got the expected key
	crypto := k.config.Crypto()
	err = crypto.VerifyTLFCryptKeyServerHalfID(serverHalfID, user, key.KID, serverHalf)
	if err != nil {
		return TLFCryptKeyServerHalf{}, err
	}
	return serverHalf, nil
}

// PutTLFCryptKeyServerHalves is an implementation of the KeyOps interface.
func (k *KeyOpsStandard) PutTLFCryptKeyServerHalves(ctx context.Context,
	serverKeyHalves map[keybase1.UID]map[keybase1.KID]TLFCryptKeyServerHalf) error {
	// upload the keys
	return k.config.KeyServer().PutTLFCryptKeyServerHalves(ctx, serverKeyHalves)
}
