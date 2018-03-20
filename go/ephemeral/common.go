package ephemeral

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// Keys last at most one week
const KeyLifetimeSecs = keybase1.Time(time.Hour * 24 * 7) // one week
// Everyday we want to generate a new key if possible
const KeyGenLifetimeSecs = keybase1.Time(time.Hour * 24) // one day

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
		if (nowCTime - currentCTime) >= (KeyLifetimeSecs + expiryOffset) {
			expired = append(expired, generation)
		}
	}

	return expired
}
