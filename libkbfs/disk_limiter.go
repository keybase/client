package libkbfs

import (
	"golang.org/x/net/context"
)

type diskBlockCacheLimiter interface {
	// onDiskBlockCacheDelete is called by the disk block cache after deleting
	// blocks from the cache.
	onDiskBlockCacheDelete(ctx context.Context, blockBytes int64)

	// beforeDiskBlockCachePut is called by the disk block cache before putting
	// a block into the cache. It returns how many bytes it acquired.
	beforeDiskBlockCachePut(ctx context.Context, blockBytes,
		diskBlockCacheBytes int64) (bytesAvailable int64, err error)
}

// diskLimiter is an interface for limiting disk usage.
type diskLimiter interface {
	diskBlockCacheLimiter
	// onJournalEnable is called when initializing a TLF journal
	// with that journal's current disk usage. Both journalBytes
	// and journalFiles must be >= 0. The updated available byte
	// and file count must be returned.
	onJournalEnable(
		ctx context.Context, journalBytes, journalFiles int64) (
		availableBytes, availableFiles int64)

	// onJournalDisable is called when shutting down a TLF journal
	// with that journal's current disk usage. Both journalBytes
	// and journalFiles must be >= 0.
	onJournalDisable(ctx context.Context, journalBytes, journalFiles int64)

	// beforeBlockPut is called before putting a block of the
	// given byte and file count, both of which must be > 0. It
	// may block, but must return immediately with a
	// (possibly-wrapped) ctx.Err() if ctx is cancelled. The
	// updated available byte and file count must be returned,
	// even if err is non-nil.
	beforeBlockPut(ctx context.Context,
		blockBytes, blockFiles int64) (
		availableBytes, availableFiles int64, err error)

	// afterBlockPut is called after putting a block of the given
	// byte and file count, which must match the corresponding call to
	// beforeBlockPut. putData reflects whether or not the data
	// was actually put; if it's false, it's either because of an
	// error or because the block already existed.
	afterBlockPut(ctx context.Context,
		blockBytes, blockFiles int64, putData bool)

	// onBlocksDelete is called after deleting blocks of the given
	// byte and file count, both of which must be >= 0. (Deleting
	// a block with either zero byte or zero file count shouldn't
	// happen, but may as well let it go through.)
	onBlocksDelete(ctx context.Context, blockBytes, blockFiles int64)

	// getStatus returns an object that's marshallable into JSON
	// for use in displaying status.
	getStatus() interface{}
}
