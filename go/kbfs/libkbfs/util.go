// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/libcontext"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
)

// Runs fn (which may block) in a separate goroutine and waits for it
// to finish, unless ctx is cancelled. Returns nil only when fn was
// run to completion and succeeded.  Any closed-over variables updated
// in fn should be considered visible only if nil is returned.
func runUnlessCanceled(ctx context.Context, fn func() error) error {
	c := make(chan error, 1) // buffered, in case the request is canceled
	go func() {
		c <- fn()
	}()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case err := <-c:
		return err
	}
}

// MakeRandomRequestID generates a random ID suitable for tagging a
// request in KBFS, and very likely to be universally unique.
func MakeRandomRequestID() (string, error) {
	// Use a random ID to tag each request.  We want this to be really
	// universally unique, as these request IDs might need to be
	// propagated all the way to the server.  Use a base64-encoded
	// random 128-bit number.
	buf := make([]byte, 128/8)
	err := kbfscrypto.RandRead(buf)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

// BoolForString returns false if trimmed string is "" (empty), "0", "false", or "no"
func BoolForString(s string) bool {
	s = strings.TrimSpace(s)
	if s == "" || s == "0" || s == "false" || s == "no" {
		return false
	}
	return true
}

// PrereleaseBuild is set at compile time for prerelease builds
var PrereleaseBuild string

// VersionString returns semantic version string
func VersionString() string {
	if PrereleaseBuild != "" {
		return fmt.Sprintf("%s-%s", libkb.Version, PrereleaseBuild)
	}
	return libkb.Version
}

// CtxBackgroundSyncKeyType is the type for a context background sync key.
type CtxBackgroundSyncKeyType int

const (
	// CtxBackgroundSyncKey is set in the context for any change
	// notifications that are triggered from a background sync.
	// Observers can ignore these if they want, since they will have
	// already gotten the relevant notifications via LocalChanges.
	CtxBackgroundSyncKey CtxBackgroundSyncKeyType = iota
)

// Warninger is an interface that only waprs the Warning method.
type Warninger interface {
	Warning(format string, args ...interface{})
}

// CtxWithRandomIDReplayable returns a replayable context with a
// random id associated with the given log key.
func CtxWithRandomIDReplayable(ctx context.Context, tagKey interface{},
	tagName string, log Warninger) context.Context {
	ctx = logger.ConvertRPCTagsToLogTags(ctx)

	id, err := MakeRandomRequestID()
	if err != nil && log != nil {
		log.Warning("Couldn't generate a random request ID: %v", err)
	}
	return libcontext.NewContextReplayable(ctx, func(ctx context.Context) context.Context {
		logTags := make(logger.CtxLogTags)
		logTags[tagKey] = tagName
		newCtx := logger.NewContextWithLogTags(ctx, logTags)
		if err == nil {
			newCtx = context.WithValue(newCtx, tagKey, id)
		}
		return newCtx
	})
}

// checkDataVersion validates that the data version for a
// block pointer is valid for the given version validator
func checkDataVersion(
	versioner data.Versioner, p data.Path, ptr data.BlockPointer) error {
	if ptr.DataVer < data.FirstValidVer {
		return errors.WithStack(InvalidDataVersionError{ptr.DataVer})
	}
	if versioner != nil && ptr.DataVer > versioner.DataVersion() {
		return errors.WithStack(NewDataVersionError{p, ptr.DataVer})
	}
	return nil
}

func checkContext(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return errors.WithStack(ctx.Err())
	default:
		return nil
	}
}

func chargedToForTLF(
	ctx context.Context, sessionGetter idutil.CurrentSessionGetter,
	rootIDGetter teamRootIDGetter, osg idutil.OfflineStatusGetter,
	handle *tlfhandle.Handle) (keybase1.UserOrTeamID, error) {
	if handle.Type() == tlf.SingleTeam {
		chargedTo := handle.FirstResolvedWriter()
		if tid := chargedTo.AsTeamOrBust(); tid.IsSubTeam() {
			offline := keybase1.OfflineAvailability_NONE
			if osg != nil {
				offline = osg.OfflineAvailabilityForID(handle.TlfID())
			}

			// Subteam blocks should be charged to the root team ID.
			rootID, err := rootIDGetter.GetTeamRootID(ctx, tid, offline)
			if err != nil {
				return keybase1.UserOrTeamID(""), err
			}
			return rootID.AsUserOrTeam(), nil
		}
		return chargedTo, nil
	}

	// For private and public folders, use the session user.
	session, err := sessionGetter.GetCurrentSession(ctx)
	if err != nil {
		return keybase1.UserOrTeamID(""), err
	}
	return session.UID.AsUserOrTeam(), nil
}

// GetHandleFromFolderNameAndType returns a TLFHandle given a folder
// name (e.g., "u1,u2#u3") and a TLF type.
func GetHandleFromFolderNameAndType(
	ctx context.Context, kbpki KBPKI, idGetter tlfhandle.IDGetter,
	syncGetter syncedTlfGetterSetter, tlfName string,
	t tlf.Type) (*tlfhandle.Handle, error) {
	for {
		tlfHandle, err := tlfhandle.ParseHandle(
			ctx, kbpki, idGetter, syncGetter, tlfName, t)
		switch e := errors.Cause(err).(type) {
		case idutil.TlfNameNotCanonical:
			tlfName = e.NameToTry
		case nil:
			return tlfHandle, nil
		default:
			return nil, err
		}
	}
}

// getHandleFromFolderName returns a TLFHandle given a folder
// name (e.g., "u1,u2#u3") and a public/private bool.  DEPRECATED.
func getHandleFromFolderName(
	ctx context.Context, kbpki KBPKI, idGetter tlfhandle.IDGetter,
	syncGetter syncedTlfGetterSetter, tlfName string,
	public bool) (*tlfhandle.Handle, error) {
	// TODO(KBFS-2185): update the protocol to support requests
	// for single-team TLFs.
	t := tlf.Private
	if public {
		t = tlf.Public
	}
	return GetHandleFromFolderNameAndType(
		ctx, kbpki, idGetter, syncGetter, tlfName, t)
}

// IsWriterFromHandle checks whether the given UID is a writer for the
// given handle.  It understands team-keyed handles as well as
// classically-keyed handles.
func IsWriterFromHandle(
	ctx context.Context, h *tlfhandle.Handle, checker kbfsmd.TeamMembershipChecker,
	osg idutil.OfflineStatusGetter, uid keybase1.UID,
	verifyingKey kbfscrypto.VerifyingKey) (bool, error) {
	if h.TypeForKeying() != tlf.TeamKeying {
		return h.IsWriter(uid), nil
	}

	// Team membership needs to be checked with the service.  For a
	// SingleTeam TLF, there is always only a single writer in the
	// handle.
	tid, err := h.FirstResolvedWriter().AsTeam()
	if err != nil {
		return false, err
	}
	offline := keybase1.OfflineAvailability_NONE
	if osg != nil {
		offline = osg.OfflineAvailabilityForID(h.TlfID())
	}
	return checker.IsTeamWriter(ctx, tid, uid, verifyingKey, offline)
}

func isReaderFromHandle(
	ctx context.Context, h *tlfhandle.Handle, checker kbfsmd.TeamMembershipChecker,
	osg idutil.OfflineStatusGetter, uid keybase1.UID) (bool, error) {
	if h.TypeForKeying() != tlf.TeamKeying {
		return h.IsReader(uid), nil
	}

	// Team membership needs to be checked with the service.  For a
	// SingleTeam TLF, there is always only a single writer in the
	// handle.
	tid, err := h.FirstResolvedWriter().AsTeam()
	if err != nil {
		return false, err
	}
	offline := keybase1.OfflineAvailability_NONE
	if osg != nil {
		offline = osg.OfflineAvailabilityForID(h.TlfID())
	}
	return checker.IsTeamReader(ctx, tid, uid, offline)
}

func tlfToMerkleTreeID(id tlf.ID) keybase1.MerkleTreeID {
	switch id.Type() {
	case tlf.Private:
		return keybase1.MerkleTreeID_KBFS_PRIVATE
	case tlf.Public:
		return keybase1.MerkleTreeID_KBFS_PUBLIC
	case tlf.SingleTeam:
		return keybase1.MerkleTreeID_KBFS_PRIVATETEAM
	default:
		panic(fmt.Sprintf("Unexpected TLF type: %d", id.Type()))
	}
}

// IsOnlyWriterInNonTeamTlf returns true if and only if the TLF described by h
// is a non-team TLF, and the currently logged-in user is the only writer for
// the TLF.  In case of any error false is returned.
func IsOnlyWriterInNonTeamTlf(ctx context.Context, kbpki KBPKI,
	h *tlfhandle.Handle) bool {
	session, err := idutil.GetCurrentSessionIfPossible(
		ctx, kbpki, h.Type() == tlf.Public)
	if err != nil {
		return false
	}
	if h.TypeForKeying() == tlf.TeamKeying {
		return false
	}
	return tlf.UserIsOnlyWriter(session.Name, h.GetCanonicalName())
}

const (
	// GitStorageRootPrefix is the prefix of the temp storage root
	// directory made for single-op git operations.
	GitStorageRootPrefix = "kbfsgit"
	// ConflictStorageRootPrefix is the prefix of the temp directory
	// made for the conflict resolution disk cache.
	ConflictStorageRootPrefix = "kbfs_conflict_disk_cache"

	minAgeForStorageCleanup = 24 * time.Hour
)

func cleanOldTempStorageRoots(config Config) {
	log := config.MakeLogger("")
	ctx := CtxWithRandomIDReplayable(
		context.Background(), CtxInitKey, CtxInitID, log)

	storageRoot := config.StorageRoot()
	d, err := os.Open(storageRoot)
	if err != nil {
		log.CDebugf(ctx, "Error opening storage root %s: %+v", storageRoot, err)
		return
	}
	defer d.Close()

	fis, err := d.Readdir(0)
	if err != nil {
		log.CDebugf(ctx, "Error reading storage root %s: %+v", storageRoot, err)
		return
	}

	modTimeCutoff := config.Clock().Now().Add(-minAgeForStorageCleanup)
	cleanedOne := false
	for _, fi := range fis {
		if fi.ModTime().After(modTimeCutoff) {
			continue
		}

		if !strings.HasPrefix(fi.Name(), GitStorageRootPrefix) &&
			!strings.HasPrefix(fi.Name(), ConflictStorageRootPrefix) {
			continue
		}

		cleanedOne = true
		dir := filepath.Join(storageRoot, fi.Name())
		log.CDebugf(ctx, "Cleaning up old storage root %s, "+
			"last modified at %s", dir, fi.ModTime())
		err = os.RemoveAll(dir)
		if err != nil {
			log.CDebugf(ctx, "Error deleting %s: %+v", dir, err)
			continue
		}
	}

	if cleanedOne {
		log.CDebugf(ctx, "Done cleaning old storage roots")
	}
}

// GetLocalDiskStats returns the local disk stats, according to the
// disk block cache.
func GetLocalDiskStats(ctx context.Context, dbc DiskBlockCache) (
	bytesAvail, bytesTotal int64) {
	if dbc == nil {
		return 0, 0
	}

	dbcStatus := dbc.Status(ctx)
	if status, ok := dbcStatus["SyncBlockCache"]; ok {
		return int64(status.LocalDiskBytesAvailable),
			int64(status.LocalDiskBytesTotal)
	}
	return 0, 0
}

// FillInDiskSpaceStatus fills in the `OutOfSyncSpace`,
// prefetchStatus, and local disk space fields of the given status.
func FillInDiskSpaceStatus(
	ctx context.Context, status *keybase1.FolderSyncStatus,
	prefetchStatus keybase1.PrefetchStatus, dbc DiskBlockCache) {
	status.PrefetchStatus = prefetchStatus
	if dbc == nil {
		return
	}

	status.LocalDiskBytesAvailable, status.LocalDiskBytesTotal =
		GetLocalDiskStats(ctx, dbc)

	if prefetchStatus == keybase1.PrefetchStatus_COMPLETE {
		return
	}

	hasRoom, _, err := dbc.DoesCacheHaveSpace(
		context.Background(), DiskBlockSyncCache)
	if err != nil {
		return
	}
	status.OutOfSyncSpace = !hasRoom
}
