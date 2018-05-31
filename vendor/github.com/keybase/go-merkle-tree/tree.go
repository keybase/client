package merkleTree

import (
	"sync"

	"golang.org/x/net/context"
)

// Tree is the MerkleTree class; it needs an engine and a configuration
// to run
type Tree struct {
	sync.RWMutex
	eng StorageEngine
	cfg Config
}

// NewTree makes a new tree
func NewTree(e StorageEngine, c Config) *Tree {
	return &Tree{eng: e, cfg: c}
}

// Build a tree from scratch, taking a batch input. Provide the
// batch import (it should be sorted), and also an optional TxInfo.
func (t *Tree) Build(
	ctx context.Context, sm *SortedMap, txi TxInfo) (err error) {
	t.Lock()
	defer t.Unlock()

	var prevRoot, nextRoot Hash
	if prevRoot, err = t.eng.LookupRoot(ctx); err != nil {
		return err
	}
	if nextRoot, err = t.hashTreeRecursive(ctx,
		Level(0), sm, prevRoot); err != nil {
		return err
	}
	if err = t.eng.CommitRoot(ctx, prevRoot, nextRoot, txi); err != nil {
		return err
	}

	return err
}

func (t *Tree) hashTreeRecursive(ctx context.Context,
	level Level, sm *SortedMap, prevRoot Hash) (ret Hash, err error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	if sm.Len() <= t.cfg.n {
		ret, err = t.makeLeaf(ctx, level, sm, prevRoot)
		return ret, err
	}

	m := t.cfg.m // the number of children we have
	var j ChildIndex
	ncpm := newChildPointerMap(m)

	for i := ChildIndex(0); i < m; i++ {
		prefix := t.cfg.formatPrefix(i)
		start := j
		for j < sm.Len() && t.cfg.prefixAtLevel(level, sm.at(j).Key).Eq(prefix) {
			j++
		}
		end := j
		if start < end {
			sublist := sm.slice(start, end)
			ret, err = t.hashTreeRecursive(ctx, level+1, sublist, nil)
			if err != nil {
				return nil, err
			}
			ncpm.set(i, ret)
		}
	}
	var nodeExported []byte
	if ret, _, nodeExported, err = ncpm.exportToNode(t.cfg.hasher, prevRoot, level); err != nil {
		return nil, err
	}
	err = t.eng.StoreNode(ctx, ret, nodeExported)
	return ret, err

}

func (t *Tree) makeLeaf(ctx context.Context, l Level, sm *SortedMap, prevRoot Hash) (ret Hash, err error) {
	var nodeExported []byte
	if ret, _, nodeExported, err = sm.exportToNode(t.cfg.hasher, prevRoot, l); err != nil {
		return nil, err
	}
	if err = t.eng.StoreNode(ctx, ret, nodeExported); err != nil {
		return nil, err
	}
	return ret, err
}

func (t *Tree) verifyNode(h Hash, raw []byte) (err error) {
	h2 := t.cfg.hasher.Hash(raw)
	if !h.Eq(h2) {
		err = HashMismatchError{H: h}
	}
	return err
}

func (t *Tree) lookupNode(ctx context.Context, h Hash) ([]byte, *Node, error) {
	b, err := t.eng.LookupNode(ctx, h)
	if err != nil {
		return nil, nil, err
	}
	if b == nil {
		return nil, nil, NodeNotFoundError{H: h}
	}
	var node Node
	err = decodeFromBytes(&node, b)
	if err != nil {
		return nil, nil, err
	}
	return b, &node, nil
}

func (t *Tree) findGeneric(ctx context.Context, h Hash, skipVerify bool) (ret interface{}, root Hash, err error) {
	t.RLock()
	defer t.RUnlock()

	root, err = t.eng.LookupRoot(ctx)
	if err != nil {
		return nil, nil, err
	}
	curr := root
	var level Level
	for curr != nil {
		var node *Node
		var nodeExported []byte
		nodeExported, node, err = t.lookupNode(ctx, curr)
		if err != nil {
			return nil, nil, err
		}
		if !skipVerify {
			if err = t.verifyNode(curr, nodeExported); err != nil {
				return nil, nil, err
			}
		}

		if node.Type == nodeTypeLeaf {
			ret = node.findValueInLeaf(h)
			return ret, root, nil
		}
		_, index := t.cfg.prefixAndIndexAtLevel(level, h)
		curr, err = node.findChildByIndex(index)
		if err != nil {
			return nil, nil, err
		}
		level++
	}
	return ret, root, err
}

func (t *Tree) findTyped(ctx context.Context, h Hash, skipVerify bool) (ret interface{}, root Hash, err error) {
	ret, root, err = t.findGeneric(ctx, h, skipVerify)
	if err != nil {
		return nil, nil, err
	}

	// Slightly hacky --- reenocode to bytes, and the encode again
	// into the typed container. For now, this will do. Long term, it
	// might be a waste of a few CPU cycles.
	var tmp []byte
	tmp, err = encodeToBytes(ret)
	if err != nil {
		return nil, nil, err
	}
	obj := t.cfg.v.Construct()
	err = decodeFromBytes(&obj, tmp)
	if err != nil {
		return nil, nil, err
	}

	return obj, root, nil
}

// Find the hash in the tree. Return the value stored at the leaf under
// that hash, or nil if not found.  Return an error if there was an
// internal problem.
func (t *Tree) Find(ctx context.Context, h Hash) (ret interface{}, root Hash, err error) {
	return t.findTyped(ctx, h, false)
}

// findUnsafe shouldn't be used, since it will skip hash comparisons
// at interior nodes.  It's mainly here for testing.
func (t *Tree) findUnsafe(ctx context.Context, h Hash) (ret interface{}, root Hash, err error) {
	return t.findTyped(ctx, h, true)
}

type step struct {
	p Prefix
	i ChildIndex
	n *Node
	l Level
}

type path struct{ steps []step }

func (p *path) push(s step) { p.steps = append(p.steps, s) }
func (p path) len() Level   { return Level(len(p.steps)) }

func (p *path) reverse() {
	j := len(p.steps) - 1
	for i := 0; i < j; i++ {
		p.steps[i], p.steps[j] = p.steps[j], p.steps[i]
		j--
	}
}

// Upsert inserts or updates the leaf with the given KeyValuePair
// information.  It will associate the given transaction info
// if specified.
func (t *Tree) Upsert(ctx context.Context, kvp KeyValuePair, txinfo TxInfo) (err error) {
	t.Lock()
	defer t.Unlock()

	root, err := t.eng.LookupRoot(ctx)
	if err != nil {
		return err
	}

	prevRoot := root
	var last *Node

	var path path
	var level Level
	var curr *Node

	// Root might be nil if we're upserting into an empty tree
	if root != nil {
		_, curr, err = t.lookupNode(ctx, root)
		if err != nil {
			return err
		}
	}

	// Find the path from the key up to the root;
	// find by walking down from the root.
	for curr != nil {
		prefix, index := t.cfg.prefixAndIndexAtLevel(level, kvp.Key)
		path.push(step{p: prefix, n: curr, l: level, i: index})
		level++
		last = curr
		if curr.Type == nodeTypeLeaf {
			break
		}
		nxt, err := curr.findChildByIndex(index)
		if err != nil {
			return err
		}
		if nxt == nil {
			break
		}
		_, curr, err = t.lookupNode(ctx, nxt)
		if err != nil {
			return err
		}
	}

	// Figure out what to store at the node where we stopped going down the path.
	var sm *SortedMap
	if last == nil || last.Type == nodeTypeINode {
		sm = newSortedMapFromKeyAndValue(kvp)
		level = 0
	} else if val2 := last.findValueInLeaf(kvp.Key); val2 == nil || !deepEqual(val2, kvp.Value) {
		sm = newSortedMapFromNode(last).replace(kvp)
		level = path.len() - 1
	} else {
		return nil
	}

	// Make a new subtree out of our new node.
	hsh, err := t.hashTreeRecursive(ctx, level, sm, prevRoot)
	if err != nil {
		return err
	}

	path.reverse()

	for _, step := range path.steps {
		if step.n.Type != nodeTypeINode {
			continue
		}
		sm := newChildPointerMapFromNode(step.n).set(step.i, hsh)
		var nodeExported []byte
		hsh, _, nodeExported, err = sm.exportToNode(t.cfg.hasher, prevRoot, step.l)
		if err != nil {
			return err
		}
		err = t.eng.StoreNode(ctx, hsh, nodeExported)
		if err != nil {
			return err
		}
	}
	err = t.eng.CommitRoot(ctx, prevRoot, hsh, txinfo)

	return err
}
