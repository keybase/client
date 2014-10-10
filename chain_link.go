package libkb

import (
	"encoding/hex"
	"fmt"
)

const (
	LINK_ID_LEN = 32
)

type LinkId []byte

func LinkIdFromHex(s string) (LinkId, error) {
	bv, err := hex.DecodeString(s)
	if err == nil && len(bv) != LINK_ID_LEN {
		err = fmt.Errorf("Bad link ID; wrong length: %d", len(bv))
		bv = nil
	}
	var ret LinkId
	if bv != nil {
		ret = LinkId(bv)
	}
	return ret, err
}

func (p LinkId) ToString() string {
	return hex.EncodeToString(p)
}

type ChainLink struct {
}

func (c ChainLink) Prev() LinkId {
	return nil
}

func LoadLinkFromStorage(id LinkId) (*ChainLink, error) {
	return nil, nil
}
