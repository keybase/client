package ephemeral

import (
	"context"
	"fmt"
	"sort"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// NOTE: If you change this value you should change it in web/ephemeral.iced
// and go/ekreaperd/reaper.go as well.
// Keys last at most one week
const KeyLifetimeSecs = 60 * 60 * 24 * 7 // one week
// Everyday we want to generate a new key if possible
const KeyGenLifetimeSecs = 60 * 60 * 24 // one day

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

func newEKUnboxErr(boxType EKType, boxGeneration keybase1.EkGeneration, missingType EKType, missingGeneration keybase1.EkGeneration) *EKUnboxErr {
	return &EKUnboxErr{
		missingType:       missingType,
		boxType:           boxType,
		missingGeneration: missingGeneration,
		boxGeneration:     boxGeneration,
	}
}

func (e *EKUnboxErr) Error() string {
	return fmt.Sprintf("Error unboxing %s@generation:%v missing %s@generation:%v", e.boxType, e.boxGeneration, e.missingType, e.missingGeneration)
}

func ctimeIsStale(ctime keybase1.Time, currentMerkleRoot libkb.MerkleRoot) bool {
	return currentMerkleRoot.Ctime()-ctime.UnixSeconds() >= KeyLifetimeSecs
}

func keygenNeeded(ctime keybase1.Time, currentMerkleRoot libkb.MerkleRoot) bool {
	return currentMerkleRoot.Ctime()-ctime.UnixSeconds() >= KeyGenLifetimeSecs
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

// Keys expire after `KeyLifetimeSecs` unless there has been a gap in their
// generation. If there has been a gap of more than a day (the normal
// generation time), a key can be re-used for up to `KeyLifetimeSecs` until it
// is considered expired. to determine expiration, we look at all of the
// current keys and account for any gaps since we don't want to expire a key if
// it is still used to encrypt a different key. This only applies to deviceEKs
// or userEKs since they can have a dependency above them.  A teamEK expires
// after `KeyLifetimeSecs` without exception, so it doesn't call this.
func getExpiredGenerations(keyMap keyExpiryMap, nowCTime keybase1.Time) (expired []keybase1.EkGeneration) {

	// Sort the generations we have so we can walk through them in order.
	var keys []keybase1.EkGeneration
	for k := range keyMap {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool { return keys[i] < keys[j] })

	var nextCTime keybase1.Time
	var expiryOffset keybase1.Time
	for i, generation := range keys {
		currentCTime := keyMap[generation]
		if i < len(keys)-1 {
			nextCTime = keyMap[keys[i+1]]
		} else {
			nextCTime = nowCTime
		}
		expiryOffset = nextCTime - currentCTime
		if expiryOffset > KeyLifetimeSecs { // Offset can be max KeyLifetimeSecs
			expiryOffset = KeyLifetimeSecs
		}
		// Keys can live for as long as KeyLifetimeSecs + expiryOffset
		if (nowCTime - currentCTime) >= (keybase1.TimeFromSeconds(KeyLifetimeSecs) + expiryOffset) {
			expired = append(expired, generation)
		}
	}

	return expired
}
