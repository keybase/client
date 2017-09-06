package git

import (
	"crypto/rand"
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
)

// Crypto implements Cryptoer interface.
type Crypto struct {
	libkb.Contextified
}

var _ Cryptoer = &Crypto{}

// NewCrypto returns a Crypto object.
func NewCrypto(g *libkb.GlobalContext) *Crypto {
	return &Crypto{
		Contextified: libkb.NewContextified(g),
	}
}

// Box encrypts the plaintext with the most current key for the given team. It yields a NaCl
// ciphertext and nonce, and also says which generation of the key it used.
func (c *Crypto) Box(ctx context.Context, plaintext []byte, teamSpec keybase1.TeamIDWithVisibility) (*keybase1.EncryptedGitMetadata, error) {
	arg := keybase1.LoadTeamArg{
		ID: teamSpec.TeamID,
	}
	team, err := teams.Load(ctx, c.G(), arg)
	if err != nil {
		return nil, err
	}

	key, err := team.GitMetadataKey(ctx)
	if err != nil {
		return nil, err
	}

	var nonce keybase1.BoxNonce
	if _, err := rand.Read(nonce[:]); err != nil {
		return nil, err
	}

	return &keybase1.EncryptedGitMetadata{
		Gen: key.KeyGeneration,
		N:   nonce,
	}, nil
}

// Unbox decrypts the given ciphertext with the given nonce, for the given generation of the
// given team. Can return an error. Will return a non-nil plaintext on success.
func (c *Crypto) Unbox(ctx context.Context, team keybase1.TeamIDWithVisibility, metadata *keybase1.EncryptedGitMetadata) (plaintext []byte, err error) {
	return nil, errors.New("nyi")
}
