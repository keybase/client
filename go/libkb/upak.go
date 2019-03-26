package libkb

// UPAK = "User Plus All Keys"

import (
	"fmt"

	"github.com/keybase/client/go/kbcrypto"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// BaseProofSet creates a basic proof set for a user with their
// keybase and uid proofs and any pgp fingerprint proofs.
func BaseProofSet(u *keybase1.UserPlusKeysV2AllIncarnations) *ProofSet {
	proofs := []Proof{
		{Key: "keybase", Value: u.GetName()},
		{Key: "uid", Value: u.GetUID().String()},
	}
	for _, key := range u.Current.PGPKeys {
		proofs = append(proofs, Proof{Key: PGPAssertionKey, Value: key.Fingerprint.String()})
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
	if IsPGPAlgo(kbcrypto.AlgoType(kid.GetKeyType())) {
		found = checkKIDPGP(u, kid)
		return found, nil, false
	}
	return checkKIDKeybase(u, kid)
}

func GetRemoteChainLinkFor(m MetaContext, follower *keybase1.UserPlusKeysV2AllIncarnations, followeeUsername NormalizedUsername, followeeUID keybase1.UID) (ret *TrackChainLink, err error) {
	defer m.Trace(fmt.Sprintf("UPAK#GetRemoteChainLinkFor(%s,%s,%s)", follower.Current.GetUID(), followeeUsername, followeeUID), func() error { return err })()
	m.VLogf(VLog1, "| Full user: %+v\n", *follower)
	rtl := follower.GetRemoteTrack(followeeUID)
	if rtl == nil {
		m.VLogf(VLog0, "| no remote track found")
		return nil, nil
	}
	if !NewNormalizedUsername(rtl.Username).Eq(followeeUsername) {
		return nil, UIDMismatchError{Msg: fmt.Sprintf("Usernames didn't match for (%s,%q); got %s", followeeUID, followeeUsername.String(), rtl.Uid)}
	}
	if !rtl.Uid.Equal(followeeUID) {
		return nil, UIDMismatchError{Msg: fmt.Sprintf("UIDs didn't match for (%s,%q); got %s", followeeUID, followeeUsername.String(), rtl.Uid)}
	}
	var lid LinkID
	m.VLogf(VLog0, "| remote track found with linkID=%s", rtl.LinkID)
	lid, err = ImportLinkID(rtl.LinkID)
	if err != nil {
		m.Debug("| Failed to import link ID")
		return nil, err
	}
	var link *ChainLink
	link, err = ImportLinkFromStorage(m, lid, follower.GetUID())
	if err != nil {
		m.Debug("| failed to import link from storage")
		return nil, err
	}
	if link == nil {
		m.Debug("| no cached chainlink found")
		// Such a bug is only possible if the DB cache was reset after
		// this user was originally loaded in; otherwise, all of this
		// UPAK's chain links should be available on disk.
		return nil, InconsistentCacheStateError{}
	}
	ret, err = ParseTrackChainLink(GenericChainLink{link})
	m.VLogf(VLog0, "| ParseTrackChainLink -> found=%v", (ret != nil))
	return ret, err
}

func TrackChainLinkFromUPK2AI(m MetaContext, follower *keybase1.UserPlusKeysV2AllIncarnations, followeeUsername NormalizedUsername, followeeUID keybase1.UID) (*TrackChainLink, error) {
	tcl, err := GetRemoteChainLinkFor(m, follower, followeeUsername, followeeUID)
	if err != nil {
		return nil, err
	}
	tcl, err = TrackChainLinkFor(m, follower.Current.Uid, followeeUID, tcl, err)
	return tcl, err
}

func NormalizedUsernameFromUPK2(u keybase1.UserPlusKeysV2) NormalizedUsername {
	return NewNormalizedUsername(u.Username)
}
