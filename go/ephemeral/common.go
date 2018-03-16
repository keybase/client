package ephemeral

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

const KeyLifetimeSecs = 60 * 60 * 24 * 7 // one week

func makeNewRandomSeed() (seed keybase1.Bytes32, err error) {
	bs, err := libkb.RandBytes(32)
	if err != nil {
		return seed, err
	}
	return libkb.MakeByte32(bs), nil
}
