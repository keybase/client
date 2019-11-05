package storage

import (
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// ***
// If we change this, make sure to update libkb.EncryptionReasonChatLocalStorage as well!
// Also see the encrypteddb package's cryptoVersion.
// ***
const cryptoVersion = 1

func GetSecretBoxKey(ctx context.Context, g *libkb.GlobalContext) (fkey [32]byte, err error) {
	return encrypteddb.GetSecretBoxKey(ctx, g, libkb.EncryptionReasonChatLocalStorage, "encrypt chat message")
}

func GetSecretBoxKeyWithUID(ctx context.Context, g *libkb.GlobalContext, uid gregor1.UID) (fkey [32]byte, err error) {
	uid2, err := keybase1.UIDFromString(uid.String())
	if err != nil {
		return [32]byte{}, err
	}
	return encrypteddb.GetSecretBoxKeyWithUID(ctx, g, uid2, libkb.EncryptionReasonChatLocalStorage, "encrypt chat message")
}
