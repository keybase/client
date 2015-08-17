package libkbfs

import "github.com/keybase/client/go/libkb"

func fakeBlockID(b byte) BlockID {
	h := libkb.NodeHashShort{b}
	return BlockID{h}
}

func fakeBlockIDAdd(id BlockID, b byte) BlockID {
	return fakeBlockID(id.Hash[0] + b)
}

func fakeBlockIDMul(id BlockID, b byte) BlockID {
	return fakeBlockID(id.Hash[0] * b)
}
