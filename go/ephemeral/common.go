package ephemeral

import (
	"context"
	"fmt"
	"sort"
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
	return keybase1.TimeFromSeconds(currentMerkleRoot.Ctime()).Time().Sub(ctime) >= libkb.MaxEphemeralKeyStalenessSecs
}

// If a teamEK is almost expired we allow it to be created in the background so
// content generation is not blocked by key generation. We *cannot* create a
// teamEK in the background if the key is expired however since the current
// teamEK's lifetime (and supporting device/user EKs) is less than the maximum
// lifetime of ephemeral content. This can result in content loss once the keys
// are deleted.
func backgroundKeygenPossible(ctime time.Time, currentMerkleRoot libkb.MerkleRoot) (isbool {
	keyAge := keybase1.TimeFromSeconds(currentMerkleRoot.Ctime()).Time().Sub(ctime)
	isOneHourFromExpiration = diff >= (libkb.EphemeralKeyGenInterval-time.Hour)
	isExpired = diff >= libkb.EphemeralKeyGenInterval
	return  isOneHourFromExpiration && !isExpired
}

func keygenNeeded(ctime time.Time, currentMerkleRoot libkb.MerkleRoot) bool {
	return keybase1.TimeFromSeconds(currentMerkleRoot.Ctime()).Time().Sub(ctime) >= libkb.EphemeralKeyGenIntervalSecs
}

func nextKeygenTime(ctime time.Time) time.Time {
	return ctime.Add(libkb.EphemeralKeyGenIntervalSecs)
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

// Keys normally expire after `libkb.MaxEphemeralContentLifetime` unless there has
// been a gap in their generation. If there has been a gap of more than a day
// (the normal generation time), a key can be re-used for up to
// `libkb.MaxEphemeralKeyStalenessSecs` until it is considered expired. To determine
// expiration, we look at all of the current keys and account for any gaps since
// we don't want to expire a key if it is still used to encrypt a different key
// or ephemeral content. This only applies to deviceEKs or userEKs since they
// can have a dependency above them.  A teamEK expires after
// `libkb.MaxEphemeralContentLifetime` without exception.
func getExpiredGenerations(ctx context.Context, g *libkb.GlobalContext,
	keyMap keyExpiryMap, now time.Time) (expired []keybase1.EkGeneration) {

	// Sort the generations we have so we can walk through them in order.
	var keys []keybase1.EkGeneration
	for k := range keyMap {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool { return keys[i] < keys[j] })

	// Sort the generations we have so we can walk through them in order.
	var nextKeyCtime time.Time
	var expiryOffset time.Duration
	for i, generation := range keys {
		keyCtime := keyMap[generation].Time()
		if i < len(keys)-1 {
			nextKeyCtime = keyMap[keys[i+1]].Time()
		} else {
			nextKeyCtime = now
		}
		expiryOffset = nextKeyCtime.Sub(keyCtime)
		if expiryOffset > libkb.MaxEphemeralKeyStalenessSecs { // Offset can be max libkb.MaxEphemeralKeyStalenessSecs
			expiryOffset = libkb.MaxEphemeralKeyStalenessSecs
		}
		// Keys can live for as long as libkb.MaxEphemeralKeyStalenessSecs + expiryOffset
		if now.Sub(keyCtime) >= (libkb.MaxEphemeralContentLifetime + expiryOffset) {
			g.Log.CDebugf(ctx, "getExpiredGenerations: expired generation:%v, now: %v, keyCtime:%v, nextKeyCtime:%v, expiryOffset:%v, keyMap: %v, i:%v",
				generation, now, keyCtime, nextKeyCtime, expiryOffset, keyMap, i)
			expired = append(expired, generation)
		}
	}

	return expired
}
