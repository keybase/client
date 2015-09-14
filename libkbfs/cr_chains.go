package libkbfs

import "fmt"

type crOpNode struct {
	op     op
	refPtr BlockPointer
	nextOp *crOpNode
}

type crChains struct {
	heads     map[BlockPointer]*crOpNode
	tails     map[BlockPointer]*crOpNode
	tailHeads map[BlockPointer]BlockPointer
	root      BlockPointer
}

func (cc *crChains) addOp(ptr BlockPointer, op op) error {
	currTailNode, ok := cc.tails[ptr]
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
		cc.tails[ptr] = newTailNode
	}

	return nil
}

func (cc *crChains) makeChainForOp(op op) error {
	// First set the heads and tails for all updates.  We only care
	// about updates, because new blocks cannot conflict directly with
	// anything else.
	for _, update := range op.AllUpdates() {
		node, ok := cc.tails[update.Unref]
		if !ok {
			// No matching tail means it's time to start a new chain
			node = &crOpNode{}
			cc.heads[update.Unref] = node
		}
		if node.refPtr.IsInitialized() {
			// delete the old tail, it's no longer needed
			delete(cc.tails, node.refPtr)
		}
		node.refPtr = update.Ref
		cc.tails[update.Ref] = node

		// keep track of the head for this tail
		if currHead, ok := cc.tailHeads[update.Unref]; ok {
			delete(cc.tailHeads, update.Unref)
			cc.tailHeads[update.Ref] = currHead
		} else {
			cc.tailHeads[update.Ref] = update.Unref
		}
	}

	// then set the op depending on the actual op type
	switch realOp := op.(type) {
	default:
		panic(fmt.Sprintf("Unrecognized operation: %v", op))
	case *createOp:
		err := cc.addOp(realOp.Dir.Ref, op)
		if err != nil {
			return err
		}
	case *rmOp:
		err := cc.addOp(realOp.Dir.Ref, op)
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
		err := cc.addOp(realOp.NewDir.Ref, co)
		if err != nil {
			return err
		}

		ro := newRmOp(realOp.OldName, realOp.OldDir.Unref)
		ro.Dir.Ref = realOp.OldDir.Ref
		err = cc.addOp(realOp.OldDir.Ref, ro)
		if err != nil {
			return err
		}
	case *syncOp:
		err := cc.addOp(realOp.File.Ref, op)
		if err != nil {
			return err
		}
	case *setAttrOp:
		err := cc.addOp(realOp.Dir.Ref, op)
		if err != nil {
			return err
		}
	case *gcOp:
		// ignore gc op
	}

	return nil
}

// collapse finds complementary pairs of operations that cancel each
// other out, and remove the relevant operations from the chain.
// Examples include:
//  * A create followed by a remove for the same name (delete both ops)
//  * A create followed by a create (renamed == true) for the same name
//    (delete the create op)
func (cc *crChains) collapse() {
	for ptr, head := range cc.heads {
		createsSeen := make(map[string]*crOpNode)
		node := head
		updated := false
		for node != nil {
			switch realOp := node.op.(type) {
			case *createOp:
				if prevCreate, ok :=
					createsSeen[realOp.NewName]; realOp.renamed && ok {
					prevCreate.op = nil
					updated = true
				}
				createsSeen[realOp.NewName] = node
			case *rmOp:
				if prevCreate, ok := createsSeen[realOp.OldName]; ok {
					delete(createsSeen, realOp.OldName)
					prevCreate.op = nil
					node.op = nil
					updated = true
				}
			default:
				// ignore other op types
			}
			node = node.nextOp
		}

		if !updated {
			continue
		}

		// Skip past everything with a nil op.  Note that we leave the
		// heads and tail pointers the same, even if we've deleted
		// some of the corresponding nodes, because those are still
		// the valid starting and ending block pointers even in a
		// collapsed state.
		node = head
		var prevNode *crOpNode
		for node != nil {
			if node.op == nil {
				if prevNode != nil {
					prevNode.nextOp = node.nextOp
					if _, ok := cc.tails[node.refPtr]; ok &&
						node.nextOp == nil {
						cc.tails[node.refPtr] = prevNode
					}
				}
			} else {
				if prevNode == nil {
					cc.heads[ptr] = node
				}
				prevNode = node
			}
			node = node.nextOp
		}
		// if there were no good nodes, delete the whole chain
		if prevNode == nil {
			delete(cc.heads, ptr)
		}
	}
}

func newCRChains(rmds []*RootMetadata) (cc *crChains, err error) {
	cc = &crChains{
		heads:     make(map[BlockPointer]*crOpNode),
		tails:     make(map[BlockPointer]*crOpNode),
		tailHeads: make(map[BlockPointer]BlockPointer),
	}

	// For each MD update, turn each update in each op into map
	// entries and create crOpNodes for the BlockPointers that are
	// affected directly by the operation.
	for _, rmd := range rmds {
		// tailHeads tracks the head->tail mapping for the complete
		// chain within this MD update.  We need it to be able to find
		// the head root pointer.
		for _, op := range rmd.data.Changes.Ops {
			err := cc.makeChainForOp(op)
			if err != nil {
				return nil, err
			}
		}

		if !cc.root.IsInitialized() {
			// Find the root head pointer
			cc.root = cc.tailHeads[rmd.data.Dir.BlockPointer]
		}

	}
	cc.collapse()
	return cc, nil
}
