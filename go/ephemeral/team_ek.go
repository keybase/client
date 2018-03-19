package ephemeral

import (
	"context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type TeamEKSeed keybase1.Bytes32

func newTeamEphemeralSeed() (seed TeamEKSeed, err error) {
	randomSeed, err := makeNewRandomSeed()
	if err != nil {
		return seed, err
	}
	return TeamEKSeed(randomSeed), nil
}

func newTeamEKSeedFromBytes(b []byte) (s TeamEKSeed, err error) {
	seed, err := newEKSeedFromBytes(b)
	if err != nil {
		return s, err
	}
	return TeamEKSeed(seed), nil
}

func (s *TeamEKSeed) DeriveDHKey() (key *libkb.NaclDHKeyPair, err error) {
	return deriveDHKey(keybase1.Bytes32(*s), libkb.DeriveReasonTeamEKEncryption)
}

// TODO fill in stubs
func PublishNewTeamEK(ctx context.Context, g *libkb.GlobalContext) (metadata keybase1.TeamEkMetadata, err error) {
	return metadata, err
}

func VerifySigWithLatestPTK(ctx context.Context, g *libkb.GlobalContext, sig string) (metadata *keybase1.TeamEkMetadata, wrongKID bool, err error) {
	return metadata, wrongKID, err
}
