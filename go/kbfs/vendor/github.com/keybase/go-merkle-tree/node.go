package merkleTree

import (
	"encoding/hex"
	"encoding/json"
)

func (n *Node) findChildByIndex(i ChildIndex) (Hash, error) {
	if n.INodes == nil || int(i) >= len(n.INodes) {
		return nil, ErrBadINode
	}
	return n.INodes[i], nil
}

func (n Node) export(h Hasher, prevRoot Hash, level Level) (hash Hash, node Node, objExported []byte, err error) {
	if prevRoot != nil && level == Level(0) {
		n.PrevRoot = prevRoot
	}
	objExported, err = encodeToBytes(n)
	if err == nil {
		hash = h.Hash(objExported)
	}
	return hash, n, objExported, err
}

func dump(i interface{}) string {
	ret, _ := json.MarshalIndent(i, "", "   ")
	return string(ret)
}

// MarshalJSON prints out a hash for debugging purposes. Not recommended for actual
// JSONing
func (h Hash) MarshalJSON() ([]byte, error) {
	if len(h) == 0 {
		return []byte("\"\""), nil
	}
	return []byte("\"" + hex.EncodeToString(h)[0:8] + "\""), nil
}

func (n *Node) findValueInLeaf(h Hash) interface{} {
	kvp := newSortedMapFromNode(n).find(h)
	if kvp == nil {
		return nil
	}
	return kvp.Value
}
