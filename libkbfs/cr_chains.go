package libkbfs

import (
	"fmt"

	"golang.org/x/net/context"
)

// crChain represents the set of operations that happened to a
// particular KBFS node (e.g., individual file or directory) over a
// given set of MD updates.  It also tracks the starting and ending
// block pointers for the node.
type crChain struct {
	ops                  []op
	original, mostRecent BlockPointer
}

// collapse finds complementary pairs of operations that cancel each
// other out, and remove the relevant operations from the chain.
// Examples include:
//  * A create followed by a remove for the same name (delete both ops)
//  * A create followed by a create (renamed == true) for the same name
//    (delete the create op)
func (cc *crChain) collapse() {
	createsSeen := make(map[string]int)
	indicesToRemove := make(map[int]bool)
	for i, op := range cc.ops {
		switch realOp := op.(type) {
		case *createOp:
			if prevCreateIndex, ok :=
				createsSeen[realOp.NewName]; realOp.renamed && ok {
				// A rename has papered over the first create, so
				// just drop it.
				indicesToRemove[prevCreateIndex] = true
			}
			createsSeen[realOp.NewName] = i
		case *rmOp:
			if prevCreateIndex, ok := createsSeen[realOp.OldName]; ok {
				delete(createsSeen, realOp.OldName)
				// The rm cancels out the create, so remove both.
				indicesToRemove[prevCreateIndex] = true
				indicesToRemove[i] = true
			}
		case *setAttrOp:
			// TODO: Collapse opposite setex pairs
		default:
			// ignore other op types
		}
	}

	if len(indicesToRemove) > 0 {
		ops := make([]op, 0, len(cc.ops)-len(indicesToRemove))
		for i, op := range cc.ops {
			if !indicesToRemove[i] {
				ops = append(ops, op)
			}
		}
		cc.ops = ops
	}
}

func (cc *crChain) getActionsToMerge(renamer ConflictRenamer, mergedPath path,
	mergedChain *crChain) ([]crAction, error) {
	// Check each op against all ops in the corresponding merged
	// chain, looking for conflicts.  If there is a conflict, return
	// it as part of the action list.  If there are no conflicts for
	// that op, return the op's default actions.
	var actions []crAction
	for _, unmergedOp := range cc.ops {
		conflict := false
		if mergedChain != nil {
			for _, mergedOp := range mergedChain.ops {
				action, err :=
					unmergedOp.CheckConflict(renamer, mergedOp)
				if err != nil {
					return nil, err
				}
				if action != nil {
					conflict = true
					actions = append(actions, action)
				}
			}
		}
		// no conflicts!
		if !conflict {
			actions = append(actions, unmergedOp.GetDefaultAction(mergedPath))
		}
	}

	return actions, nil
}

type renameInfo struct {
	originalOldParent BlockPointer
	oldName           string
	originalNewParent BlockPointer
	newName           string
}

// crChains contains a crChain for every KBFS node affected by the
// operations over a given set of MD updates.  The chains are indexed
// by both the starting (original) and ending (most recent) pointers.
// It also keeps track of which chain points to the root of the folder.
type crChains struct {
	byOriginal   map[BlockPointer]*crChain
	byMostRecent map[BlockPointer]*crChain
	originalRoot BlockPointer

	// The original blockpointers for nodes that have been
	// unreferenced or initially referenced during this chain.
	deletedOriginals map[BlockPointer]bool
	createdOriginals map[BlockPointer]bool

	// A map from original blockpointer to the full rename operation
	// of the node (from the original location of the node to the
	// final locations).
	renamedOriginals map[BlockPointer]renameInfo
}

func (ccs *crChains) addOp(ptr BlockPointer, op op) error {
	currChain, ok := ccs.byMostRecent[ptr]
	if !ok {
		return fmt.Errorf("Could not find chain for most recent ptr %v", ptr)
	}

	currChain.ops = append(currChain.ops, op)
	return nil
}

func (ccs *crChains) makeChainForOp(op op) error {
	// First set the pointers for all updates, and track what's been
	// created and destroyed.
	for _, update := range op.AllUpdates() {
		chain, ok := ccs.byMostRecent[update.Unref]
		if !ok {
			// No matching chain means it's time to start a new chain
			chain = &crChain{original: update.Unref}
			ccs.byOriginal[update.Unref] = chain
		}
		if chain.mostRecent.IsInitialized() {
			// delete the old most recent pointer, it's no longer needed
			delete(ccs.byMostRecent, chain.mostRecent)
		}
		chain.mostRecent = update.Ref
		ccs.byMostRecent[update.Ref] = chain
	}

	for _, ptr := range op.Refs() {
		ccs.createdOriginals[ptr] = true
	}

	for _, ptr := range op.Unrefs() {
		// Look up the original pointer corresponding to this most
		// recent one.
		original := ptr
		if ptrChain, ok := ccs.byMostRecent[ptr]; ok {
			original = ptrChain.original
		}

		ccs.deletedOriginals[original] = true
	}

	// then set the op depending on the actual op type
	switch realOp := op.(type) {
	default:
		panic(fmt.Sprintf("Unrecognized operation: %v", op))
	case *createOp:
		err := ccs.addOp(realOp.Dir.Ref, op)
		if err != nil {
			return err
		}
	case *rmOp:
		err := ccs.addOp(realOp.Dir.Ref, op)
		if err != nil {
			return err
		}
	case *renameOp:
		// split rename op into two separate operations, one for
		// remove and one for create
		ro := newRmOp(realOp.OldName, realOp.OldDir.Unref)
		ro.setWriterName(realOp.getWriterName())
		ro.Dir.Ref = realOp.OldDir.Ref
		err := ccs.addOp(realOp.OldDir.Ref, ro)
		if err != nil {
			return err
		}

		ndu := realOp.NewDir.Unref
		ndr := realOp.NewDir.Ref
		if realOp.NewDir == (blockUpdate{}) {
			// this is a rename within the same directory
			ndu = realOp.OldDir.Unref
			ndr = realOp.OldDir.Ref
		}

		co := newCreateOp(realOp.NewName, ndu,
			File /*type is arbitrary and won't be used*/)
		co.setWriterName(realOp.getWriterName())
		co.renamed = true
		co.Dir.Ref = ndr
		err = ccs.addOp(ndr, co)
		if err != nil {
			return err
		}

		// also keep track of the new parent for the renamed node
		if realOp.Renamed.IsInitialized() {
			newParentChain, ok := ccs.byMostRecent[ndr]
			if !ok {
				return fmt.Errorf("While renaming, couldn't find the chain "+
					"for the new parent %v", ndr)
			}
			oldParentChain, ok := ccs.byMostRecent[realOp.OldDir.Ref]
			if !ok {
				return fmt.Errorf("While renaming, couldn't find the chain "+
					"for the old parent %v", ndr)
			}

			renamedOriginal := realOp.Renamed
			if renamedChain, ok := ccs.byMostRecent[realOp.Renamed]; ok {
				renamedOriginal = renamedChain.original
			}
			// Use the previous old info if there is one already,
			// in case this node has been renamed multiple times.
			ri, ok := ccs.renamedOriginals[renamedOriginal]
			if !ok {
				// Otherwise make a new one.
				ri = renameInfo{
					originalOldParent: oldParentChain.original,
					oldName:           realOp.OldName,
				}
			}
			ri.originalNewParent = newParentChain.original
			ri.newName = realOp.NewName
			ccs.renamedOriginals[renamedOriginal] = ri
		}
	case *syncOp:
		err := ccs.addOp(realOp.File.Ref, op)
		if err != nil {
			return err
		}
	case *setAttrOp:
		// Because the attributes apply to the file, which doesn't
		// actually have an updated pointer, we may need to create a
		// new chain.
		_, ok := ccs.byMostRecent[realOp.File]
		if !ok {
			// pointer didn't change, so most recent is the same:
			chain := &crChain{original: realOp.File, mostRecent: realOp.File}
			ccs.byOriginal[realOp.File] = chain
			ccs.byMostRecent[realOp.File] = chain
		}

		err := ccs.addOp(realOp.File, op)
		if err != nil {
			return err
		}
	case *gcOp:
		// ignore gc op
	}

	return nil
}

func (ccs *crChains) mostRecentFromOriginal(original BlockPointer) (
	BlockPointer, error) {
	chain, ok := ccs.byOriginal[original]
	if !ok {
		return BlockPointer{}, NoChainFoundError{original}
	}
	return chain.mostRecent, nil
}

func (ccs *crChains) originalFromMostRecent(mostRecent BlockPointer) (
	BlockPointer, error) {
	chain, ok := ccs.byMostRecent[mostRecent]
	if !ok {
		return BlockPointer{}, NoChainFoundError{mostRecent}
	}
	return chain.original, nil
}

func (ccs *crChains) isCreated(original BlockPointer) bool {
	return ccs.createdOriginals[original]
}

func (ccs *crChains) isDeleted(original BlockPointer) bool {
	return ccs.deletedOriginals[original]
}

func (ccs *crChains) renamedParentAndName(original BlockPointer) (
	BlockPointer, string, bool) {
	info, ok := ccs.renamedOriginals[original]
	if !ok {
		return BlockPointer{}, "", false
	}
	return info.originalNewParent, info.newName, true
}

func newCRChains(ctx context.Context, kbpki KBPKI, rmds []*RootMetadata) (
	ccs *crChains, err error) {
	ccs = &crChains{
		byOriginal:       make(map[BlockPointer]*crChain),
		byMostRecent:     make(map[BlockPointer]*crChain),
		deletedOriginals: make(map[BlockPointer]bool),
		createdOriginals: make(map[BlockPointer]bool),
		renamedOriginals: make(map[BlockPointer]renameInfo),
	}

	// For each MD update, turn each update in each op into map
	// entries and create chains for the BlockPointers that are
	// affected directly by the operation.
	for _, rmd := range rmds {
		writerName, err := kbpki.GetNormalizedUsername(ctx, rmd.data.LastWriter)
		if err != nil {
			return nil, err
		}

		for _, op := range rmd.data.Changes.Ops {
			op.setWriterName(writerName)
			err := ccs.makeChainForOp(op)
			if err != nil {
				return nil, err
			}
		}

		if !ccs.originalRoot.IsInitialized() {
			// Find the original pointer for the root directory
			if rootChain, ok :=
				ccs.byMostRecent[rmd.data.Dir.BlockPointer]; ok {
				ccs.originalRoot = rootChain.original
			}
		}

	}

	for _, chain := range ccs.byOriginal {
		chain.collapse()
		// NOTE: even if we've removed all its ops, still keep the
		// chain around so we can see the mapping between the original
		// and most recent pointers.
	}

	return ccs, nil
}

type crChainSummary struct {
	Path string
	Ops  []string
}

func (ccs *crChains) summary(identifyChains *crChains,
	nodeCache NodeCache) (res []*crChainSummary) {
	for _, chain := range ccs.byOriginal {
		summary := &crChainSummary{}
		res = append(res, summary)

		// first stringify all the ops so they are displayed even if
		// we can't find the path.
		for _, op := range chain.ops {
			summary.Ops = append(summary.Ops, op.String())
		}

		// find the path name using the identified most recent pointer
		n := nodeCache.Get(chain.mostRecent)
		if n == nil {
			summary.Path = fmt.Sprintf("Unknown path: %v", chain.mostRecent)
			continue
		}

		path := nodeCache.PathFromNode(n)
		summary.Path = path.String()
	}

	return res
}

func (ccs *crChains) removeChain(ptr BlockPointer) {
	delete(ccs.byOriginal, ptr)
	delete(ccs.byMostRecent, ptr)
}
