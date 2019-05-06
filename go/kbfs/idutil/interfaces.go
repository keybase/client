// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package idutil

import (
	"context"
	"time"

	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/protocol/keybase1"
)

// Resolver is an interface to be used to resolve assertions, implicit
// teams and team TLF IDs.
type Resolver interface {
	// Resolve, given an assertion, resolves it to a username/UID
	// pair. The username <-> UID mapping is trusted and
	// immutable, so it can be cached. If the assertion is just
	// the username or a UID assertion, then the resolution can
	// also be trusted. If the returned pair is equal to that of
	// the current session, then it can also be
	// trusted. Otherwise, Identify() needs to be called on the
	// assertion before the assertion -> (username, UserOrTeamID) mapping
	// can be trusted.
	//
	//
	// If the caller knows that the assertion needs to be resolvable
	// while offline, they should pass in
	// `keybase1.OfflineAvailability_BEST_EFFORT` as the `offline`
	// parameter.  Otherwise `Resolve` might block on a network call.
	//
	// TODO: some of the above assumptions on cacheability aren't
	// right for subteams, which can change their name, so this may
	// need updating.
	Resolve(ctx context.Context, assertion string,
		offline keybase1.OfflineAvailability) (
		kbname.NormalizedUsername, keybase1.UserOrTeamID, error)

	// ResolveImplicitTeam resolves the given implicit team.
	//
	// If the caller knows that the team needs to be resolvable while
	// offline, they should pass in
	// `keybase1.OfflineAvailability_BEST_EFFORT` as the `offline`
	// parameter.  Otherwise `ResolveImplicitTeam` might block on a
	// network call.
	ResolveImplicitTeam(
		ctx context.Context, assertions, suffix string, tlfType tlf.Type,
		offline keybase1.OfflineAvailability) (ImplicitTeamInfo, error)

	// ResolveImplicitTeamByID resolves the given implicit team, given
	// a team ID.
	//
	// If the caller knows that the team needs to be resolvable while
	// offline, they should pass in
	// `keybase1.OfflineAvailability_BEST_EFFORT` as the `offline`
	// parameter.  Otherwise `ResolveImplicitTeamByID` might block on
	// a network call.
	ResolveImplicitTeamByID(
		ctx context.Context, teamID keybase1.TeamID, tlfType tlf.Type,
		offline keybase1.OfflineAvailability) (ImplicitTeamInfo, error)
	// ResolveTeamTLFID returns the TLF ID associated with a given
	// team ID, or tlf.NullID if no ID is yet associated with that
	// team.
	//
	// If the caller knows that the ID needs to be resolved while
	// offline, they should pass in
	// `keybase1.OfflineAvailability_BEST_EFFORT` as the `offline`
	// parameter.  Otherwise `ResolveTeamTLFID` might block on a
	// network call.
	ResolveTeamTLFID(
		ctx context.Context, teamID keybase1.TeamID,
		offline keybase1.OfflineAvailability) (tlf.ID, error)

	// NormalizeSocialAssertion creates a SocialAssertion from its input and
	// normalizes it.  The service name will be lowercased.  If the service is
	// case-insensitive, then the username will also be lowercased.  Colon
	// assertions (twitter:user) will be transformed to the user@twitter
	// format.  Only registered services are allowed.
	NormalizeSocialAssertion(
		ctx context.Context, assertion string) (keybase1.SocialAssertion, error)
}

// NormalizedUsernameGetter is an interface that can get a normalized
// username given an ID.
type NormalizedUsernameGetter interface {
	// GetNormalizedUsername returns the normalized username
	// corresponding to the given UID.
	//
	// If the caller knows that the assertion needs to be resolvable
	// while offline, they should pass in
	// `keybase1.OfflineAvailability_BEST_EFFORT` as the `offline`
	// parameter.  Otherwise `GetNormalizedUsername` might block on a
	// network call.
	GetNormalizedUsername(
		ctx context.Context, id keybase1.UserOrTeamID,
		offline keybase1.OfflineAvailability) (
		kbname.NormalizedUsername, error)
}

// OfflineStatusGetter indicates whether a given TLF needs to be
// available offline.
type OfflineStatusGetter interface {
	OfflineAvailabilityForPath(tlfPath string) keybase1.OfflineAvailability
	OfflineAvailabilityForID(tlfID tlf.ID) keybase1.OfflineAvailability
}

// Identifier is an interface that can identify users and teams given
// assertions.
type Identifier interface {
	// Identify resolves an assertion (which could also be a
	// username) to a UserInfo struct, spawning tracker popups if
	// necessary.  The reason string is displayed on any tracker
	// popups spawned.
	//
	// If the caller knows that the assertion needs to be identifiable
	// while offline, they should pass in
	// `keybase1.OfflineAvailability_BEST_EFFORT` as the `offline`
	// parameter.  Otherwise `Identify` might block on a network call.
	Identify(ctx context.Context, assertion, reason string,
		offline keybase1.OfflineAvailability) (
		kbname.NormalizedUsername, keybase1.UserOrTeamID, error)
	// IdentifyImplicitTeam identifies (and creates if necessary) the
	// given implicit team.
	//
	// If the caller knows that the team needs to be identifiable
	// while offline, they should pass in
	// `keybase1.OfflineAvailability_BEST_EFFORT` as the `offline`
	// parameter.  Otherwise `IdentifyImplicitTeam` might block on a
	// network call.
	IdentifyImplicitTeam(
		ctx context.Context, assertions, suffix string, tlfType tlf.Type,
		reason string, offline keybase1.OfflineAvailability) (
		ImplicitTeamInfo, error)
}

// CurrentSessionGetter is an interface for objects that can return
// session info.
type CurrentSessionGetter interface {
	// GetCurrentSession gets the current session info.
	GetCurrentSession(ctx context.Context) (SessionInfo, error)
}

// KBPKI is an interface for something that can resolve, identify, get
// user names, and get the current session.
type KBPKI interface {
	NormalizedUsernameGetter
	Resolver
	Identifier
	CurrentSessionGetter
}

// Clock is an interface for getting the current time
type Clock interface {
	// Now returns the current time.
	Now() time.Time
}

// MerkleRootGetter is an interface for getting and verifying global
// Merkle roots.
type MerkleRootGetter interface {
	// GetCurrentMerkleRoot returns the current root of the global
	// Keybase Merkle tree.
	GetCurrentMerkleRoot(ctx context.Context) (
		keybase1.MerkleRootV2, time.Time, error)
	// VerifyMerkleRoot checks that the specified merkle root
	// contains the given KBFS root; if not, it returns an error.
	VerifyMerkleRoot(
		ctx context.Context, root keybase1.MerkleRootV2,
		kbfsRoot keybase1.KBFSRoot) error
}

// KeybaseService is a low-level interface for interacting with the
// Keybase service process, for the purposes of resolving and
// identifying users and teams.
type KeybaseService interface {
	MerkleRootGetter

	// Resolve, given an assertion, resolves it to a username/UID
	// pair. The username <-> UID mapping is trusted and
	// immutable, so it can be cached. If the assertion is just
	// the username or a UID assertion, then the resolution can
	// also be trusted. If the returned pair is equal to that of
	// the current session, then it can also be
	// trusted. Otherwise, Identify() needs to be called on the
	// assertion before the assertion -> (username, UID) mapping
	// can be trusted.
	//
	// If the caller knows that the assertion needs to be resolvable
	// while offline, they should pass in
	// `keybase1.OfflineAvailability_BEST_EFFORT` as the `offline`
	// parameter.  Otherwise `Resolve` might block on a network call.
	Resolve(ctx context.Context, assertion string,
		offline keybase1.OfflineAvailability) (
		kbname.NormalizedUsername, keybase1.UserOrTeamID, error)

	// Identify, given an assertion, returns a name and ID that
	// matches that assertion, or an error otherwise. The reason
	// string is displayed on any tracker popups spawned.
	//
	// If the caller knows that the assertion needs to be identifiable
	// while offline, they should pass in
	// `keybase1.OfflineAvailability_BEST_EFFORT` as the `offline`
	// parameter.  Otherwise `Identify` might block on a network call.
	Identify(ctx context.Context, assertion, reason string,
		offline keybase1.OfflineAvailability) (
		kbname.NormalizedUsername, keybase1.UserOrTeamID, error)

	// NormalizeSocialAssertion creates a SocialAssertion from its input and
	// normalizes it.  The service name will be lowercased.  If the service is
	// case-insensitive, then the username will also be lowercased.  Colon
	// assertions (twitter:user) will be transformed to the user@twitter
	// format.  Only registered services are allowed.
	NormalizeSocialAssertion(
		ctx context.Context, assertion string) (keybase1.SocialAssertion, error)

	// ResolveIdentifyImplicitTeam resolves, and optionally
	// identifies, an implicit team.  If the implicit team doesn't yet
	// exist, and doIdentifies is true, one is created.
	//
	// If the caller knows that the team needs to be resolvable while
	// offline, they should pass in
	// `keybase1.OfflineAvailability_BEST_EFFORT` as the `offline`
	// parameter.  Otherwise `ResolveIdentifyImplicitTeam` might block
	// on a network call.
	ResolveIdentifyImplicitTeam(
		ctx context.Context, assertions, suffix string, tlfType tlf.Type,
		doIdentifies bool, reason string,
		offline keybase1.OfflineAvailability) (ImplicitTeamInfo, error)

	// ResolveImplicitTeamByID resolves an implicit team to a team
	// name, given a team ID.
	ResolveImplicitTeamByID(
		ctx context.Context, teamID keybase1.TeamID) (string, error)

	// CreateTeamTLF associates the given TLF ID with the team ID in
	// the team's sigchain.  If the team already has a TLF ID
	// associated with it, this overwrites it.
	CreateTeamTLF(
		ctx context.Context, teamID keybase1.TeamID, tlfID tlf.ID) error

	// GetTeamSettings returns the KBFS settings for the given team.
	//
	// If the caller knows that the settings needs to be readable
	// while offline, they should pass in
	// `keybase1.OfflineAvailability_BEST_EFFORT` as the `offline`
	// parameter.  Otherwise `GetTeamSettings` might block on a
	// network call.
	GetTeamSettings(
		ctx context.Context, teamID keybase1.TeamID,
		offline keybase1.OfflineAvailability) (keybase1.KBFSTeamSettings, error)

	// LoadUserPlusKeys returns a UserInfo struct for a
	// user with the specified UID.
	// If you have the UID for a user and don't require Identify to
	// validate an assertion or the identity of a user, use this to
	// get UserInfo structs as it is much cheaper than Identify.
	//
	// pollForKID, if non empty, causes `PollForKID` field to be
	// populated, which causes the service to poll for the given
	// KID. This is useful during provisioning where the provisioner
	// needs to get the MD revision that the provisionee has set the
	// rekey bit on.
	//
	// If the caller knows that the user needs to be loadable while
	// offline, they should pass in
	// `keybase1.OfflineAvailability_BEST_EFFORT` as the `offline`
	// parameter.  Otherwise `LoadUserPlusKeys` might block on a
	// network call.
	LoadUserPlusKeys(
		ctx context.Context, uid keybase1.UID, pollForKID keybase1.KID,
		offline keybase1.OfflineAvailability) (UserInfo, error)

	// LoadTeamPlusKeys returns a TeamInfo struct for a team with the
	// specified TeamID.  The caller can specify `desiredKeyGen` to
	// force a server check if that particular key gen isn't yet
	// known; it may be set to UnspecifiedKeyGen if no server check is
	// required.  The caller can specify `desiredUID` and
	// `desiredRole` to force a server check if that particular UID
	// isn't a member of the team yet according to local caches; it
	// may be set to "" if no server check is required.
	//
	// If the caller knows that the team needs to be loadable while
	// offline, they should pass in
	// `keybase1.OfflineAvailability_BEST_EFFORT` as the `offline`
	// parameter.  Otherwise `LoadTeamPlusKeys` might block on a
	// network call.
	LoadTeamPlusKeys(ctx context.Context, tid keybase1.TeamID,
		tlfType tlf.Type, desiredKeyGen kbfsmd.KeyGen,
		desiredUser keybase1.UserVersion, desiredKey kbfscrypto.VerifyingKey,
		desiredRole keybase1.TeamRole, offline keybase1.OfflineAvailability) (
		TeamInfo, error)

	// CurrentSession returns a SessionInfo struct with all the
	// information for the current session, or an error otherwise.
	CurrentSession(ctx context.Context, sessionID int) (
		SessionInfo, error)
}
