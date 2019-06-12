package git

import (
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// Teamer handles teams for use with the Git index
type Teamer interface {
	// LookupOrCreate either lookups or creates a team that corresponds to the given Folder
	// Does not create new named teams.
	LookupOrCreate(ctx context.Context, folder keybase1.FolderHandle) (teamID keybase1.TeamIDWithVisibility, err error)
}

// Cryptoer handles crypto operations to encrypt and decrypt data as it is
// sent to or received from the server-side Git index.
type Cryptoer interface {
	// Box encrypts the plaintext with the most current key for the given team. It yields a NaCl
	// ciphertext and nonce, and also says which generation of the key it used.
	Box(ctx context.Context, plaintext []byte, team keybase1.TeamIDWithVisibility) (*keybase1.EncryptedGitMetadata, error)
	// Unbox decrypts the given ciphertext with the given nonce, for the given generation of the
	// given team. Can return an error. Will return a non-nil plaintext on success.
	Unbox(ctx context.Context, team keybase1.TeamIDWithVisibility, metadata *keybase1.EncryptedGitMetadata) (plaintext []byte, err error)
}
