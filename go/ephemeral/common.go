package ephemeral

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

const KeyLifetimeSecs = 60 * 60 * 24 * 7 // one week

func makeNewRandomSeed() (seed keybase1.Bytes32, err error) {
	bs, err := libkb.RandBytes(libkb.NaclDHKeysize)
	if err != nil {
		return seed, err
	}
	return libkb.MakeByte32(bs), nil

}

func deriveDHKey(k keybase1.Bytes32, reason libkb.DeriveReason) (key *libkb.NaclDHKeyPair, err error) {
	derived, err := libkb.DeriveFromSecret(k, reason)
	if err != nil {
		return nil, err
	}
	keypair, err := libkb.MakeNaclDHKeyPairFromSecret(derived)
	return &keypair, err
}

func newEKSeedFromBytes(b []byte) (seed keybase1.Bytes32, err error) {
	if len(b) != libkb.NaclDHKeysize {
		err = fmt.Errorf("Wrong EkSeed len: %d != %d", len(b), libkb.NaclDHKeysize)
		return seed, err
	}
	copy(seed[:], b)
	return seed, nil
}
