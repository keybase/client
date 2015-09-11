package libkbfs

import "fmt"

type crOpNode struct {
	op     op
	refPtr BlockPointer
	nextOp *crOpNode
}

func crAddOpToChain(ptr BlockPointer, op op,
	tails map[BlockPointer]*crOpNode) error {
	currTailNode, ok := tails[ptr]
	if !ok {
		return fmt.Errorf("Could not find tail node for ptr %v", ptr)
	}

	// If this node has no op yet, populate one.  If it does have an
	// op, start a new node.
	if currTailNode.op == nil {
		currTailNode.op = op
	} else {
		newTailNode := &crOpNode{op, ptr, nil}
		currTailNode.nextOp = newTailNode
		tails[ptr] = newTailNode
	}

	return nil
}

func crMakeChainForOp(op op, heads map[BlockPointer]*crOpNode,
	tails map[BlockPointer]*crOpNode,
	tailHeads map[BlockPointer]BlockPointer) error {
	// First set the heads and tails for all updates.  We only care
	// about updates, because new blocks cannot conflict directly with
	// anything else.
	for _, update := range op.AllUpdates() {
		node, ok := tails[update.Unref]
		if !ok {
			// No matching tail means it's time to start a new chain
			node = &crOpNode{}
			heads[update.Unref] = node
		}
		if node.refPtr.IsInitialized() {
			// delete the old tail, it's no longer needed
			delete(tails, node.refPtr)
		}
		node.refPtr = update.Ref
		tails[update.Ref] = node

		// keep track of the head for this tail
		if currHead, ok := tailHeads[update.Unref]; ok {
			delete(tailHeads, update.Unref)
			tailHeads[update.Ref] = currHead
		} else {
			tailHeads[update.Ref] = update.Unref
		}
	}

	// then set the op depending on the actual op type
	switch realOp := op.(type) {
	default:
		panic(fmt.Sprintf("Unrecognized operation: %v", op))
	case *createOp:
		err := crAddOpToChain(realOp.Dir.Ref, op, tails)
		if err != nil {
			return err
		}
	case *rmOp:
		err := crAddOpToChain(realOp.Dir.Ref, op, tails)
		if err != nil {
			return err
		}
	case *renameOp:
		// split rename op into two separate operations, one for
		// create and one for remove
		co := newCreateOp(realOp.NewName, realOp.NewDir.Unref,
			File /*type is arbitrary and won't be used*/)
		co.renamed = true
		co.Dir.Ref = realOp.NewDir.Ref
		err := crAddOpToChain(realOp.NewDir.Ref, co, tails)
		if err != nil {
			return err
		}

		ro := newRmOp(realOp.OldName, realOp.OldDir.Unref)
		ro.Dir.Ref = realOp.OldDir.Ref
		err = crAddOpToChain(realOp.OldDir.Ref, ro, tails)
		if err != nil {
			return err
		}
	case *syncOp:
		err := crAddOpToChain(realOp.File.Ref, op, tails)
		if err != nil {
			return err
		}
	case *setAttrOp:
		err := crAddOpToChain(realOp.Dir.Ref, op, tails)
		if err != nil {
			return err
		}
	case *gcOp:
		// ignore gc op
	}

	return nil
}

func crMakeChains(rmds []*RootMetadata) (heads map[BlockPointer]*crOpNode,
	tails map[BlockPointer]*crOpNode, root BlockPointer, err error) {
	heads = make(map[BlockPointer]*crOpNode)
	tails = make(map[BlockPointer]*crOpNode)

	// For each MD update, turn each update in each op into map
	// entries and create crOpNodes for the BlockPointers that are
	// affected directly by the operation.
	for _, rmd := range rmds {
		// tailHeads tracks the head->tail mapping for the complete
		// chain within this MD update.  We need it to be able to find
		// the head root pointer.
		tailHeads := make(map[BlockPointer]BlockPointer)
		for _, op := range rmd.data.Changes.Ops {
			err := crMakeChainForOp(op, heads, tails, tailHeads)
			if err != nil {
				return nil, nil, BlockPointer{}, err
			}
		}

		if !root.IsInitialized() {
			// Find the root head pointer
			root = tailHeads[rmd.data.Dir.BlockPointer]
		}

	}
	return heads, tails, root, nil
}
