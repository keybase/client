package libfuse

import (
	"runtime"
	"time"

	"bazil.org/fuse"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

const (
	// PublicName is the name of the parent of all public top-level folders.
	PublicName = "public"

	// PrivateName is the name of the parent of all private top-level folders.
	PrivateName = "private"

	// CtxAppIDKey is the context app id
	CtxAppIDKey = "kbfsfuse-app-id"

	// CtxOpID is the display name for the unique operation FUSE ID tag.
	CtxOpID = "FID"
)

// CtxTagKey is the type used for unique context tags
type CtxTagKey int

const (
	// CtxIDKey is the type of the tag for unique operation IDs.
	CtxIDKey CtxTagKey = iota
)

// NewContextWithOpID adds a unique ID to this context, identifying
// a particular request.
func NewContextWithOpID(ctx context.Context,
	log logger.Logger) context.Context {
	if runtime.GOOS == "darwin" {
		// Timeout operations before they hit the osxfuse time limit,
		// so we don't hose the entire mount.  The timeout is 60
		// seconds, but it looks like sometimes it tries multiple
		// attempts within that 60 seconds, so let's go a little under
		// 60/3 to be safe.
		ctx, _ = context.WithTimeout(ctx, 19*time.Second)
	}
	id, err := libkbfs.MakeRandomRequestID()
	if err != nil {
		log.Errorf("Couldn't make request ID: %v", err)
		return ctx
	}
	return context.WithValue(ctx, CtxIDKey, id)
}

// fillAttr sets attributes based on the entry info. It only handles fields
// common to all entryinfo types.
func fillAttr(ei *libkbfs.EntryInfo, a *fuse.Attr) {
	a.Valid = 1 * time.Minute

	a.Size = ei.Size
	a.Mtime = time.Unix(0, ei.Mtime)
	a.Ctime = time.Unix(0, ei.Ctime)
}
