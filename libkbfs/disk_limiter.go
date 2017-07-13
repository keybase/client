package libkbfs

import (
	"fmt"

	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type diskLimitTrackerType int

type unknownTrackerTypeError struct {
	typ diskLimitTrackerType
}

func (e unknownTrackerTypeError) Error() string {
	return fmt.Sprintf("Unknown tracker type: %d", e.typ)
}

const (
	unknownLimitTrackerType diskLimitTrackerType = iota
	journalLimitTrackerType
	workingSetCacheLimitTrackerType
	syncCacheLimitTrackerType
)

// simpleResourceTracker is an interface for limiting a single resource type.
// It is mostly used to limit bytes.
type simpleResourceTracker interface {
	onEnable(usedResources int64) int64
	onDisable(usedResources int64)
	updateFree(freeResources int64)
	usedBytes() int64
	reserve(ctx context.Context, resources int64) (available int64, err error)
	tryReserve(resources int64) (available int64)
	commit(resources int64)
	rollback(resources int64)
	commitOrRollback(resources int64, shouldCommit bool)
	release(resources int64)
}

// DiskLimiter is an interface for limiting disk usage.
type DiskLimiter interface {
	// onSimpleByteTrackerEnable is called when a byte tracker is enabled to
	// begin accounting. This should be called by consumers of disk space that
	// only track bytes (i.e. not the journal tracker).
	onSimpleByteTrackerEnable(ctx context.Context, typ diskLimitTrackerType,
		cacheBytes int64)

	// onSimpleByteTrackerDisable is called when a byte tracker is disabled to
	// stop accounting. This should be called by consumers of disk space that
	// only track bytes (i.e. not the journal tracker).
	onSimpleByteTrackerDisable(ctx context.Context, typ diskLimitTrackerType,
		cacheBytes int64)

	// onJournalEnable is called when initializing a TLF journal
	// with that journal's current disk usage. Both journalBytes
	// and journalFiles must be >= 0. The updated available byte
	// and file count must be returned.
	onJournalEnable(ctx context.Context,
		journalStoredBytes, journalUnflushedBytes, journalFiles int64,
		chargedTo keybase1.UserOrTeamID) (
		availableBytes, availableFiles int64)

	// onJournalDisable is called when shutting down a TLF journal
	// with that journal's current disk usage. Both journalBytes
	// and journalFiles must be >= 0.
	onJournalDisable(ctx context.Context,
		journalStoredBytes, journalUnflushedBytes, journalFiles int64,
		chargedTo keybase1.UserOrTeamID)

	// reserveWithBackpressure is called before using disk storage of the given
	// byte and file count, both of which must be > 0. It may block, but must
	// return immediately with a (possibly-wrapped) ctx.Err() if ctx is
	// cancelled. The updated available byte and file count must be returned,
	// even if err is non-nil.
	reserveWithBackpressure(ctx context.Context, typ diskLimitTrackerType,
		blockBytes, blockFiles int64, chargedTo keybase1.UserOrTeamID) (
		availableBytes, availableFiles int64, err error)

	// reserveBytes is called a number of bytes equal to `blockBytes` by a
	// consumer of disk space that only tracks bytes, before actually using
	// that disk space. It returns the total number of available bytes.
	// reserveBytes() should not block. If there aren't enough bytes available,
	// no reservation is made, and a negative number is returned indicating how
	// much space must be freed to make the requested reservation possible.
	reserveBytes(ctx context.Context, typ diskLimitTrackerType, blockBytes int64) (
		availableBytes int64, err error)

	// commitOrRollback is called after using disk storage of the given byte
	// and file count, which must match the corresponding call to
	// beforeBlockPut. `shouldCommit` reflects whether we should commit. A
	// false value will cause a rollback instead. If the `typ` is a type that
	// only tracks bytes, `blockFiles` is ignored.
	commitOrRollback(ctx context.Context, typ diskLimitTrackerType, blockBytes,
		blockFiles int64, shouldCommit bool, chargedTo keybase1.UserOrTeamID)

	// release is called after releasing byte and/or file usage, both of which
	// must be >= 0. Unlike reserve and commitOrRollback, this is a one-step
	// operation.
	release(ctx context.Context, typ diskLimitTrackerType, blockBytes,
		blockFiles int64)

	// onBlocksFlush is called after flushing blocks of the given
	// byte count, which must be >= 0. (Flushing a block with a
	// zero byte count shouldn't happen, but may as well let it go
	// through.)
	onBlocksFlush(ctx context.Context, blockBytes int64,
		chargedTo keybase1.UserOrTeamID)

	// getQuotaInfo returns the quota info as known by the disk
	// limiter.
	getQuotaInfo(chargedTo keybase1.UserOrTeamID) (
		usedQuotaBytes, quotaBytes int64)

	// getDiskLimitInfo returns the usage and limit info for the disk,
	// as known by the disk limiter.
	getDiskLimitInfo() (usedBytes int64, limitBytes float64,
		usedFiles int64, limitFiles float64)

	// getStatus returns an object that's marshallable into JSON
	// for use in displaying status.
	getStatus(chargedTo keybase1.UserOrTeamID) interface{}
}
