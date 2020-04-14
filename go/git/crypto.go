package git

import (
	"fmt"

	"golang.org/x/crypto/nacl/secretbox"
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
)

// publicCryptKey is a zero key used for public repos
var publicCryptKey keybase1.TeamApplicationKey

func init() {
	var zero [libkb.NaclDHKeySecretSize]byte
	publicCryptKey = keybase1.TeamApplicationKey{
		Application:   keybase1.TeamApplication_GIT_METADATA,
		KeyGeneration: 1,
		Key:           keybase1.Bytes32(zero),
	}
}

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

	public := teamSpec.Visibility == keybase1.TLFVisibility_PUBLIC

	key := publicCryptKey
	if !public {
		key, err = team.GitMetadataKey(ctx)
		if err != nil {
			return nil, err
		}
	}

	nonce, err := libkb.RandomNaclDHNonce()
	if err != nil {
		return nil, err
	}

	var encKey [libkb.NaclSecretBoxKeySize]byte = key.Key
	sealed := secretbox.Seal(nil, plaintext, &nonce, &encKey)

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
	defer c.G().CTrace(ctx, fmt.Sprintf("git.Crypto#Unbox(%s, vis:%v)", teamSpec.TeamID, teamSpec.Visibility), &err)()

	if metadata.V != 1 {
		return nil, fmt.Errorf("invalid EncryptedGitMetadata version: %d", metadata.V)
	}

	public := teamSpec.Visibility == keybase1.TLFVisibility_PUBLIC
	if public != teamSpec.TeamID.IsPublic() {
		return nil, libkb.NewTeamVisibilityError(public, teamSpec.TeamID.IsPublic())
	}

	key := publicCryptKey
	if !public {
		key, err = c.fastLoadKeyAtGeneration(ctx, teamSpec, metadata)
		if err != nil {
			return nil, err
		}
	}

	var encKey [libkb.NaclSecretBoxKeySize]byte = key.Key
	var naclNonce [libkb.NaclDHNonceSize]byte = metadata.N

	plaintext, ok := secretbox.Open(nil, metadata.E, &naclNonce, &encKey)
	if !ok {
		return nil, libkb.DecryptOpenError{}
	}
	return plaintext, nil
}

func (c *Crypto) fastLoadKeyAtGeneration(ctx context.Context, teamSpec keybase1.TeamIDWithVisibility, metadata *keybase1.EncryptedGitMetadata) (key keybase1.TeamApplicationKey, err error) {
	teamID := teamSpec.TeamID
	arg := keybase1.FastTeamLoadArg{
		ID:                   teamID,
		Public:               false,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_GIT_METADATA},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{metadata.Gen},
	}
	mctx := libkb.NewMetaContext(ctx, c.G())
	res, err := mctx.G().GetFastTeamLoader().Load(mctx, arg)
	if err != nil {
		return key, err
	}
	n := len(res.ApplicationKeys)
	if n != 1 {
		return key, fmt.Errorf("wrong number of keys back from FTL; wanted 1 but got %d", n)
	}
	if metadata.Gen > 0 && res.ApplicationKeys[0].KeyGeneration != metadata.Gen {
		return key, fmt.Errorf("wrong generation back from FTL; wanted %d but got %d", metadata.Gen, res.ApplicationKeys[0].KeyGeneration)
	}

	if res.ApplicationKeys[0].Application != keybase1.TeamApplication_GIT_METADATA {
		return key, fmt.Errorf("wrong application; wanted %d but got %d", keybase1.TeamApplication_GIT_METADATA, res.ApplicationKeys[0].Application)
	}
	return res.ApplicationKeys[0], nil
}

func (c *Crypto) loadTeam(ctx context.Context, teamSpec keybase1.TeamIDWithVisibility, needKeyGeneration keybase1.PerTeamKeyGeneration) (*teams.Team, error) {
	public := teamSpec.Visibility == keybase1.TLFVisibility_PUBLIC
	arg := keybase1.LoadTeamArg{
		ID:     teamSpec.TeamID,
		Public: public,
	}
	if needKeyGeneration != 0 {
		arg.Refreshers.NeedApplicationsAtGenerations = map[keybase1.PerTeamKeyGeneration][]keybase1.TeamApplication{
			needKeyGeneration: {keybase1.TeamApplication_GIT_METADATA},
		}
	}
	team, err := teams.Load(ctx, c.G(), arg)
	if err != nil {
		return nil, err
	}

	return team, nil
}
