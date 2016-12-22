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
func checkKIDPGP(u *keybase1.UserPlusAllKeys, kid keybase1.KID) (found bool) {
	for _, key := range u.PGPKeys {
		if key.KID.Equal(kid) {
			return true
		}
	}
	return false
}

func checkKIDKeybase(u *keybase1.UserPlusAllKeys, kid keybase1.KID) (found bool, revokedAt *keybase1.KeybaseTime) {
	fmt.Printf("***** checkKIDKeybase for kid %s\n", kid)
	for _, key := range u.Base.DeviceKeys {
		fmt.Printf("***** checkKIDKeybase device key %s\n", key.KID)
		if key.KID.Equal(kid) {
			fmt.Printf("***** checkKIDKeybase device key %s matched %s\n", key.KID, kid)
			return true, nil
		}
	}
	for _, key := range u.Base.RevokedDeviceKeys {
		fmt.Printf("***** checkKIDKeybase revoked device key %s\n", key.Key.KID)
		if key.Key.KID.Equal(kid) {
			fmt.Printf("***** checkKIDKeybase revoked device key %s matched %s\n", key.Key.KID, kid)
			return true, &key.Time
		}
	}
	fmt.Printf("***** checkKIDKeybase no matches for kid %s\n", kid)
	return false, nil
}

func CheckKID(u *keybase1.UserPlusAllKeys, kid keybase1.KID) (found bool, revokedAt *keybase1.KeybaseTime) {
	if IsPGPAlgo(AlgoType(kid.GetKeyType())) {
		found = checkKIDPGP(u, kid)
		return found, nil
	}
	return checkKIDKeybase(u, kid)
}

func GetRemoteChainLinkFor(u *keybase1.UserPlusAllKeys, username NormalizedUsername, uid keybase1.UID, g *GlobalContext) (ret *TrackChainLink, err error) {
	defer g.Trace(fmt.Sprintf("UPAK.GetRemoteChainLinkFor(%s,%s,%s)", u.Base.Uid, username, uid), func() error { return err })()
	g.Log.Debug("| Full user: %+v\n", *u)
	rtl := u.GetRemoteTrack(username.String())
	if rtl == nil {
		g.Log.Debug("| no remote track found")
		return nil, nil
	}
	if !rtl.Uid.Equal(uid) {
		return nil, UIDMismatchError{Msg: fmt.Sprintf("didn't match username %q", username.String())}
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
