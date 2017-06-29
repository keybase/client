package libkb

// UPAK = "User Plus All Keys"

import (
	"fmt"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// BaseProofSet creates a basic proof set for a user with their
// keybase and uid proofs and any pgp fingerprint proofs.
func BaseProofSet(u *keybase1.UserPlusAllKeys) *ProofSet {
	proofs := []Proof{
		{Key: "keybase", Value: u.GetName()},
		{Key: "uid", Value: u.GetUID().String()},
	}
	for _, key := range u.PGPKeys {
		proofs = append(proofs, Proof{Key: PGPAssertionKey, Value: key.PGPFingerprint})
	}
	return NewProofSet(proofs)
}

// checkKIDPGP checks that the user has the given PGP KID valid *now*. Note that it doesn't
// check for revoked PGP keys, and it also does not check key expiration.
func checkKIDPGP(u *keybase1.UserPlusKeysV2AllIncarnations, kid keybase1.KID) (found bool) {
	for _, key := range u.Current.PGPKeys {
		if key.Base.Kid.Equal(kid) {
			return true
		}
	}
	return false
}

func checkKIDKeybase(u *keybase1.UserPlusKeysV2AllIncarnations, kid keybase1.KID) (found bool, revokedAt *keybase1.KeybaseTime, deleted bool) {
	exportRevokedAt := func(key keybase1.PublicKeyV2NaCl) *keybase1.KeybaseTime {
		if key.Base.Revocation != nil {
			// This is the inverse of the marshalling we do in rpc_exim.go.
			return &keybase1.KeybaseTime{
				Unix:  key.Base.Revocation.Time,
				Chain: key.Base.Revocation.PrevMerkleRootSigned.Seqno,
			}
		}
		return nil
	}
	for _, key := range u.Current.DeviceKeys {
		if key.Base.Kid.Equal(kid) {
			found = true
			revokedAt = exportRevokedAt(key)
		}
	}
	for _, pastIncarnation := range u.PastIncarnations {
		for _, key := range pastIncarnation.DeviceKeys {
			if key.Base.Kid.Equal(kid) {
				found = true
				deleted = true
				revokedAt = exportRevokedAt(key)
			}
		}
	}
	return
}

func CheckKID(u *keybase1.UserPlusKeysV2AllIncarnations, kid keybase1.KID) (found bool, revokedAt *keybase1.KeybaseTime, deleted bool) {
	if IsPGPAlgo(AlgoType(kid.GetKeyType())) {
		found = checkKIDPGP(u, kid)
		return found, nil, false
	}
	return checkKIDKeybase(u, kid)
}

func GetRemoteChainLinkFor(u *keybase1.UserPlusAllKeys, username NormalizedUsername, uid keybase1.UID, g *GlobalContext) (ret *TrackChainLink, err error) {
	defer g.Trace(fmt.Sprintf("UPAK#GetRemoteChainLinkFor(%s,%s,%s)", u.Base.Uid, username, uid), func() error { return err })()
	g.VDL.Log(VLog1, "| Full user: %+v\n", *u)
	rtl := u.GetRemoteTrack(username.String())
	if rtl == nil {
		g.Log.Debug("| no remote track found")
		return nil, nil
	}
	if !rtl.Uid.Equal(uid) {
		return nil, UIDMismatchError{Msg: fmt.Sprintf("UIDs didn't match for (%s,%q); got %s", uid, username.String(), rtl.Uid)}
	}
	var lid LinkID
	g.Log.Debug("| remote track found with linkID=%s", rtl.LinkID)
	lid, err = ImportLinkID(rtl.LinkID)
	if err != nil {
		g.Log.Debug("| Failed to import link ID")
		return nil, err
	}
	var link *ChainLink
	link, err = ImportLinkFromStorage(lid, u.Base.Uid, g)
	if err != nil {
		g.Log.Debug("| failed to import link from storage")
		return nil, err
	}
	if link == nil {
		g.Log.Debug("| no cached chainlink found")
		// Such a bug is only possible if the DB cache was reset after
		// this user was originally loaded in; otherwise, all of this
		// UPAK's chain links should be available on disk.
		return nil, InconsistentCacheStateError{}
	}
	ret, err = ParseTrackChainLink(GenericChainLink{link})
	g.Log.Debug("| ParseTrackChainLink -> found=%v", (ret != nil))
	return ret, err
}

func TrackChainLinkFromUserPlusAllKeys(u *keybase1.UserPlusAllKeys, username NormalizedUsername, uid keybase1.UID, g *GlobalContext) (*TrackChainLink, error) {
	tcl, err := GetRemoteChainLinkFor(u, username, uid, g)
	if _, ok := err.(InconsistentCacheStateError); ok {
		return nil, err
	}
	tcl, err = TrackChainLinkFor(u.Base.Uid, uid, tcl, err, g)
	return tcl, err
}
