// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package idutil

import (
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/protocol/keybase1"
)

const (
	// PublicUIDName is the name given to keybase1.PublicUID.  This string
	// should correspond to an illegal or reserved Keybase user name.
	PublicUIDName = "_public"
)

// RevokedKeyInfo contains any KBFS-relevant data to user keys that
// have been revoked or belong to a account before it was reset.
type RevokedKeyInfo struct {
	// Fields are exported so they can be copied by the codec.
	Time       keybase1.Time
	MerkleRoot keybase1.MerkleRootV2

	// These fields never need copying.
	sigChainLocation keybase1.SigChainLocation
	resetSeqno       keybase1.Seqno
	isReset          bool
	filledInMerkle   bool
}

// SigChainLocation returns the sigchain location for this revocation.
func (rki RevokedKeyInfo) SigChainLocation() keybase1.SigChainLocation {
	return rki.sigChainLocation
}

// SetSigChainLocation sets the sigchain location for this revocation.
func (rki *RevokedKeyInfo) SetSigChainLocation(loc keybase1.SigChainLocation) {
	rki.sigChainLocation = loc
}

// FilledInMerkle returns whether or not this key info has had its
// merkle data (like the sigchain location or the reset info) filled
// in yet.
func (rki RevokedKeyInfo) FilledInMerkle() bool {
	return rki.filledInMerkle
}

// SetFilledInMerkle sets whether or not this key info has had its
// merkle data (like the sigchain location or the reset info) filled
// in yet.
func (rki *RevokedKeyInfo) SetFilledInMerkle(filledIn bool) {
	rki.filledInMerkle = filledIn
}

// ResetInfo returns, if this key belongs to an account before it was
// reset, data about that reset.
func (rki RevokedKeyInfo) ResetInfo() (keybase1.Seqno, bool) {
	return rki.resetSeqno, rki.isReset
}

// SetResetInfo sets, if this key belongs to an account before it was
// reset, data about that reset.
func (rki *RevokedKeyInfo) SetResetInfo(seqno keybase1.Seqno, isReset bool) {
	rki.resetSeqno = seqno
	rki.isReset = isReset
}

// UserInfo contains all the info about a keybase user that kbfs cares
// about.
type UserInfo struct {
	Name            kbname.NormalizedUsername
	UID             keybase1.UID
	VerifyingKeys   []kbfscrypto.VerifyingKey
	CryptPublicKeys []kbfscrypto.CryptPublicKey
	KIDNames        map[keybase1.KID]string
	EldestSeqno     keybase1.Seqno

	// Revoked keys, and the time at which they were revoked.
	RevokedVerifyingKeys   map[kbfscrypto.VerifyingKey]RevokedKeyInfo
	RevokedCryptPublicKeys map[kbfscrypto.CryptPublicKey]RevokedKeyInfo
}

// DeepCopy returns a copy of `ui`, including deep copies of all slice
// and map members.
func (ui UserInfo) DeepCopy() UserInfo {
	copyUI := ui
	copyUI.VerifyingKeys = make(
		[]kbfscrypto.VerifyingKey, len(ui.VerifyingKeys))
	copy(copyUI.VerifyingKeys, ui.VerifyingKeys)
	copyUI.CryptPublicKeys = make(
		[]kbfscrypto.CryptPublicKey, len(ui.CryptPublicKeys))
	copy(copyUI.CryptPublicKeys, ui.CryptPublicKeys)
	copyUI.KIDNames = make(map[keybase1.KID]string, len(ui.KIDNames))
	for k, v := range ui.KIDNames {
		copyUI.KIDNames[k] = v
	}
	copyUI.RevokedVerifyingKeys = make(
		map[kbfscrypto.VerifyingKey]RevokedKeyInfo,
		len(ui.RevokedVerifyingKeys))
	for k, v := range ui.RevokedVerifyingKeys {
		copyUI.RevokedVerifyingKeys[k] = v
	}
	copyUI.RevokedCryptPublicKeys = make(
		map[kbfscrypto.CryptPublicKey]RevokedKeyInfo,
		len(ui.RevokedCryptPublicKeys))
	for k, v := range ui.RevokedCryptPublicKeys {
		copyUI.RevokedCryptPublicKeys[k] = v
	}
	return copyUI
}

// TeamInfo contains all the info about a keybase team that kbfs cares
// about.
type TeamInfo struct {
	// Maybe this should be bare string?  The service doesn't give us
	// a nice type, unfortunately.  Also note that for implicit teams,
	// this is an auto-generated name that shouldn't be shown to
	// users.
	Name         kbname.NormalizedUsername
	TID          keybase1.TeamID
	CryptKeys    map[kbfsmd.KeyGen]kbfscrypto.TLFCryptKey
	LatestKeyGen kbfsmd.KeyGen
	RootID       keybase1.TeamID // for subteams only

	Writers map[keybase1.UID]bool
	Readers map[keybase1.UID]bool

	// Last writers map a KID to the last time the writer associated
	// with that KID trasitioned from writer to non-writer.
	LastWriters map[kbfscrypto.VerifyingKey]keybase1.MerkleRootV2
}

// ImplicitTeamInfo contains information needed after
// resolving/identifying an implicit team.  TeamInfo is used for
// anything else.
type ImplicitTeamInfo struct {
	Name  kbname.NormalizedUsername // The "display" name for the i-team.
	TID   keybase1.TeamID
	TlfID tlf.ID
}

// SessionInfo contains all the info about the keybase session that
// kbfs cares about.
type SessionInfo struct {
	Name           kbname.NormalizedUsername
	UID            keybase1.UID
	CryptPublicKey kbfscrypto.CryptPublicKey
	VerifyingKey   kbfscrypto.VerifyingKey
}
