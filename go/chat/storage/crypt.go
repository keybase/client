package storage

import (
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

// ***
// If we change this, make sure to update libkb.EncryptionReasonChatLocalStorage as well!
// Also see the encrypteddb package's cryptoVersion.
// ***
const cryptoVersion = 1

func GetSecretBoxKey(ctx context.Context, g *libkb.GlobalContext, getSecretUI func() libkb.SecretUI) (fkey [32]byte, err error) {
	return encrypteddb.GetSecretBoxKey(ctx, g, getSecretUI, libkb.EncryptionReasonChatLocalStorage, "encrypt chat message")
}
