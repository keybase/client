package git

import (
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type KeyManager interface {
	LookupOrCreate(ctx context.Context, folder keybase1.Folder) (teamID keybase1.TeamIDWithVisibility, err error)
	Box(ctx context.Context, plaintext []byte, team keybase1.TeamIDWithVisibility) (ciphertext []byte, nonce keybase1.BoxNonce, keyGeneration keybase1.PerTeamKeyGeneration, err error)
	Unbox(ctx context.Context, ciphertext []byte, nonce keybase1.BoxNonce, team keybase1.TeamIDWithVisibility, keyGeneration keybase1.PerTeamKeyGeneration) (plaintext []byte, err error)
}
