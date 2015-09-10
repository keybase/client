package libkbfs

import (
	"fmt"
	"sync"

	"github.com/keybase/client/go/logger"
	"golang.org/x/net/context"
)

// CtxCRTagKey is the type used for unique context tags related to
// conflict resolution
type CtxCRTagKey int

const (
	// CtxCRIDKey is the type of the tag for unique operation IDs
	// related to conflict resolution
	CtxCRIDKey CtxCRTagKey = iota
)

// CtxCROpID is the display name for the unique operation
// conflict resolution ID tag.
const CtxCROpID = "CRID"

type conflictInput struct {
	unmerged MetadataRevision
	merged   MetadataRevision
}

// ConflictResolver is responsible for resolving conflicts in the
// background.
type ConflictResolver struct {
	config    Config
	fbo       *FolderBranchOps
	inputChan chan conflictInput
	log       logger.Logger

	currInput conflictInput
	inputLock sync.Mutex
}

// NewConflictResolver constructs a new ConflictResolver (and launches
// any necessary background goroutines).
func NewConflictResolver(
	config Config, fbo *FolderBranchOps) *ConflictResolver {
	// make a logger with an appropriate module name
	branchSuffix := ""
	if fbo.branch() != MasterBranch {
		branchSuffix = " " + string(fbo.branch())
	}
	tlfStringFull := fbo.id().String()
	log := config.MakeLogger(fmt.Sprintf("CR %s%s", tlfStringFull[:8],
		branchSuffix))

	cr := &ConflictResolver{
		config:    config,
		fbo:       fbo,
		inputChan: make(chan conflictInput),
		log:       log,
	}

	go cr.inputProcessor()
	return cr
}

func (cr *ConflictResolver) inputProcessor() {
	logTags := make(logger.CtxLogTags)
	logTags[CtxCRIDKey] = CtxCROpID
	ctx := logger.NewContextWithLogTags(context.Background(), logTags)

	var cancel func()
	defer func() {
		if cancel != nil {
			cancel()
		}
	}()
	for ci := range cr.inputChan {
		ctx := ctx
		id, err := MakeRandomRequestID()
		if err != nil {
			cr.log.Warning("Couldn't generate a random request ID: %v", err)
		} else {
			ctx = context.WithValue(ctx, CtxCRIDKey, id)
		}

		valid := func() bool {
			cr.inputLock.Lock()
			defer cr.inputLock.Unlock()
			if ci.unmerged <= cr.currInput.unmerged ||
				ci.merged <= cr.currInput.merged {
				return false
			}
			cr.log.CDebugf(ctx, "New conflict input %v following old "+
				"input %v", ci, cr.currInput)
			cr.currInput = ci
			// cancel the existing conflict resolution (if any)
			if cancel != nil {
				cancel()
			}
			return true
		}()
		if !valid {
			cr.log.CDebugf(ctx, "Ignoring uninteresting input: %v", ci)
			continue
		}

		ctx, cancel = context.WithCancel(ctx)
		go cr.doResolve(ctx, ci)
	}
}

// Resolve takes the latest known unmerged and merged revision
// numbers, and kicks off the resolution process.
func (cr *ConflictResolver) Resolve(unmerged MetadataRevision,
	merged MetadataRevision) {
	cr.inputChan <- conflictInput{unmerged, merged}
}

// Shutdown cancels any ongoing resolutions and stops any background
// goroutines.
func (cr *ConflictResolver) Shutdown() {
	close(cr.inputChan)
}

func (cr *ConflictResolver) checkDone(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
		return nil
	}
}

func (cr *ConflictResolver) getMDs(ctx context.Context) (
	unmerged []*RootMetadata, merged []*RootMetadata, err error) {
	// first get all outstanding unmerged MDs for this device
	branchPoint, unmerged, err := cr.fbo.getUnmergedMDUpdates(ctx)
	if err != nil {
		return nil, nil, err
	}

	// now get all the merged MDs, starting from after the branch point
	merged, err = cr.fbo.getMergedMDUpdates(ctx, branchPoint+1)
	return unmerged, merged, err
}

func (cr *ConflictResolver) updateCurrInput(ctx context.Context,
	unmerged []*RootMetadata, merged []*RootMetadata) error {
	cr.inputLock.Lock()
	defer cr.inputLock.Unlock()
	// check done while holding the lock, so we know for sure if
	// we've already been canceled and replaced by a new input.
	err := cr.checkDone(ctx)
	if err != nil {
		return err
	}

	if len(unmerged) > 0 {
		cr.currInput.unmerged = unmerged[len(unmerged)-1].Revision
	}
	if len(merged) > 0 {
		cr.currInput.merged = merged[len(merged)-1].Revision
	}
	return nil
}

func (cr *ConflictResolver) doResolve(ctx context.Context, ci conflictInput) {
	cr.log.CDebugf(ctx, "Starting conflict resolution with input %v", ci)
	var err error
	defer cr.log.CDebugf(ctx, "Finished conflict resolution: %v", err)

	// Canceled before we even got started?
	err = cr.checkDone(ctx)
	if err != nil {
		return
	}

	// Fetch the merged and unmerged MDs
	unmerged, merged, err := cr.getMDs(ctx)
	if err != nil {
		return
	}

	// Update the current input to reflect the MDs we'll actually be
	// working with.
	err = cr.updateCurrInput(ctx, unmerged, merged)
	if err != nil {
		return
	}
}
