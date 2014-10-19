package libkb

import (
	"crypto/sha256"
	"fmt"
)

type BtcOpts struct {
	versions []int
}

func BtcAddrCheck(s string, opts *BtcOpts) (version int, pkhash []byte, err error) {
	var ok_versions []int
	if opts != nil && opts.versions != nil {
		ok_versions = opts.versions
	} else {
		// BTC and BTC multisig, only allowed for now
		ok_versions = []int{0, 5}
	}
	buf, err := Decode58(s)
	l := len(buf)

	if err != nil {
		return
	}

	if l < 8 {
		err = fmt.Errorf("BTC address is truncated")
		return
	}

	version = int(buf[0])
	found := false
	for _, v := range ok_versions {
		if version == v {
			found = true
			break
		}
	}

	if !found {
		err = fmt.Errorf("Bad BTC address version found: %d", version)
		return
	}

	pkhash = buf[1:(l - 4)]
	c1 := buf[(l - 4):]
	tmp := sha256.Sum256(pkhash)
	c2 := sha256.Sum256(tmp[:])
	if !FastByteArrayEq(c1, c2[:]) {
		err = fmt.Errorf("Bad checksum: %v != %v", c1, c2)
	}
	return
}
