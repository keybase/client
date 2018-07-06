package ephemeral

import (
	"context"
	"fmt"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type EKType string

const (
	DeviceEKStr EKType = "deviceEK"
	UserEKStr   EKType = "userEK"
	TeamEKStr   EKType = "teamEK"
)

type EKUnboxErr struct {
	boxType           EKType
	boxGeneration     keybase1.EkGeneration
	missingType       EKType
	missingGeneration keybase1.EkGeneration
}

func newEKUnboxErr(boxType EKType, boxGeneration keybase1.EkGeneration, missingType EKType, missingGeneration keybase1.EkGeneration) EKUnboxErr {
	return EKUnboxErr{
		missingType:       missingType,
		boxType:           boxType,
		missingGeneration: missingGeneration,
		boxGeneration:     boxGeneration,
	}
}

func (e EKUnboxErr) Error() string {
	return fmt.Sprintf("Error unboxing %s@generation:%v missing %s@generation:%v", e.boxType, e.boxGeneration, e.missingType, e.missingGeneration)
}

type EKMissingBoxErr struct {
	boxType       EKType
	boxGeneration keybase1.EkGeneration
}

func newEKMissingBoxErr(boxType EKType, boxGeneration keybase1.EkGeneration) EKMissingBoxErr {
	return EKMissingBoxErr{
		boxType:       boxType,
		boxGeneration: boxGeneration,
	}
}

func (e EKMissingBoxErr) Error() string {
	return fmt.Sprintf("Missing box for %s@generation:%v", e.boxType, e.boxGeneration)
}

func ctimeIsStale(ctime time.Time, currentMerkleRoot libkb.MerkleRoot) bool {
	return keybase1.TimeFromSeconds(currentMerkleRoot.Ctime()).Time().Sub(ctime) >= libkb.MaxEphemeralKeyStaleness
}

// If a teamEK is almost expired we allow it to be created in the background so
// content generation is not blocked by key generation. We *cannot* create a
// teamEK in the background if the key is expired however since the current
// teamEK's lifetime (and supporting device/user EKs) is less than the maximum
// lifetime of ephemeral content. This can result in content loss once the keys
// are deleted.
func backgroundKeygenPossible(ctime time.Time, currentMerkleRoot libkb.MerkleRoot) bool {
	keyAge := keybase1.TimeFromSeconds(currentMerkleRoot.Ctime()).Time().Sub(ctime)
	isOneHourFromExpiration := keyAge >= (libkb.EphemeralKeyGenInterval - time.Hour)
	isExpired := keyAge >= libkb.EphemeralKeyGenInterval
	return isOneHourFromExpiration && !isExpired
}

func keygenNeeded(ctime time.Time, currentMerkleRoot libkb.MerkleRoot) bool {
	return keybase1.TimeFromSeconds(currentMerkleRoot.Ctime()).Time().Sub(ctime) >= libkb.EphemeralKeyGenInterval
}

func nextKeygenTime(ctime time.Time) time.Time {
	return ctime.Add(libkb.EphemeralKeyGenInterval)
}

func makeNewRandomSeed() (seed keybase1.Bytes32, err error) {
	bs, err := libkb.RandBytes(libkb.NaclDHKeysize)
	if err != nil {
		return seed, err
	}
	return libkb.MakeByte32(bs), nil

}

func deriveDHKey(k keybase1.Bytes32, reason libkb.DeriveReason) *libkb.NaclDHKeyPair {
	derived, err := libkb.DeriveFromSecret(k, reason)
	if err != nil {
		panic("This should never fail: " + err.Error())
	}
	keypair, err := libkb.MakeNaclDHKeyPairFromSecret(derived)
	if err != nil {
		panic("This should never fail: " + err.Error())
	}
	return &keypair
}

func newEKSeedFromBytes(b []byte) (seed keybase1.Bytes32, err error) {
	if len(b) != libkb.NaclDHKeysize {
		err = fmt.Errorf("Wrong EkSeed len: %d != %d", len(b), libkb.NaclDHKeysize)
		return seed, err
	}
	copy(seed[:], b)
	return seed, nil
}

func getCurrentUserUV(ctx context.Context, g *libkb.GlobalContext) (ret keybase1.UserVersion, err error) {
	err = g.GetFullSelfer().WithSelf(ctx, func(u *libkb.User) error {
		ret = u.ToUserVersion()
		return nil
	})
	return ret, err
}

// Map generations to their creation time
type keyExpiryMap map[keybase1.EkGeneration]keybase1.Time
