package git

import (
	"crypto/rand"
	"fmt"

	"golang.org/x/crypto/nacl/secretbox"
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
	team, err := c.loadTeam(ctx, teamSpec, 0)
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

	var encKey [libkb.NaclSecretBoxKeySize]byte = key.Key
	var naclNonce [libkb.NaclDHNonceSize]byte = nonce
	sealed := secretbox.Seal(nil, plaintext, &naclNonce, &encKey)

	return &keybase1.EncryptedGitMetadata{
		V:   libkb.CurrentGitMetadataEncryptionVersion,
		E:   sealed,
		N:   nonce,
		Gen: key.KeyGeneration,
	}, nil
}

// Unbox decrypts the given ciphertext with the given nonce, for the given generation of the
// given team. Can return an error. Will return a non-nil plaintext on success.
func (c *Crypto) Unbox(ctx context.Context, teamSpec keybase1.TeamIDWithVisibility, metadata *keybase1.EncryptedGitMetadata) (plaintext []byte, err error) {
	defer c.G().CTrace(ctx, fmt.Sprintf("git.Crypto#Unbox(%s, vis:%v)", teamSpec.TeamID, teamSpec.Visibility), func() error { return err })()

	if metadata.V != 1 {
		return nil, fmt.Errorf("invalid EncryptedGitMetadata version: %d", metadata.V)
	}

	team, err := c.loadTeam(ctx, teamSpec, metadata.Gen)
	if err != nil {
		return nil, err
	}
	key, err := team.ApplicationKeyAtGeneration(keybase1.TeamApplication_GIT_METADATA, metadata.Gen)
	if err != nil {
		return nil, err
	}

	var encKey [libkb.NaclSecretBoxKeySize]byte = key.Key
	var naclNonce [libkb.NaclDHNonceSize]byte = metadata.N

	plaintext, ok := secretbox.Open(nil, metadata.E, &naclNonce, &encKey)
	if !ok {
		return nil, libkb.DecryptOpenError{}
	}
	return plaintext, nil
}

func (c *Crypto) loadTeam(ctx context.Context, teamSpec keybase1.TeamIDWithVisibility, needKeyGeneration keybase1.PerTeamKeyGeneration) (*teams.Team, error) {
	public := teamSpec.Visibility == keybase1.TLFVisibility_PUBLIC
	arg := keybase1.LoadTeamArg{
		ID:     teamSpec.TeamID,
		Public: public,
	}
	if needKeyGeneration != 0 {
		arg.Refreshers.NeedKeyGeneration = needKeyGeneration
	}
	team, err := teams.Load(ctx, c.G(), arg)
	if err != nil {
		return nil, err
	}

	return team, nil
}
