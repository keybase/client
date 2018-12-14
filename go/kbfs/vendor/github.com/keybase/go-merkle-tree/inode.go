package merkleTree

import ()

type childPointerMap struct {
	tab []Hash
}

func newChildPointerMap(capacity ChildIndex) *childPointerMap {
	return &childPointerMap{
		tab: make([]Hash, capacity),
	}
}

func newChildPointerMapFromNode(n *Node) *childPointerMap {
	return &childPointerMap{
		tab: n.INodes,
	}
}

func (c *childPointerMap) exportToNode(h Hasher, prevRoot Hash, level Level) (hash Hash, node Node, objExported []byte, err error) {
	node.Type = nodeTypeINode
	node.INodes = c.tab
	return node.export(h, prevRoot, level)
}

func (c *childPointerMap) set(i ChildIndex, h Hash) *childPointerMap {
	c.tab[i] = h
	return c
}
