package libkb

import (
	"crypto/sha256"
	"fmt"
)

type BtcOpts struct {
	versions []int
}

func BtcAddrCheck(s string, opts *BtcOpts) (version int, pkhash []byte, err error) {
	var okVersions []int
	if opts != nil && opts.versions != nil {
		okVersions = opts.versions
	} else {
		// BTC and BTC multisig, only allowed for now
		okVersions = []int{0, 5}
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
	for _, v := range okVersions {
		if version == v {
			found = true
			break
		}
	}

	if !found {
		err = fmt.Errorf("Bad BTC address version found: %d", version)
		return
	}

	pkhash = buf[0:(l - 4)]
	c1 := buf[(l - 4):]
	tmp := sha256.Sum256(pkhash)
	tmp2 := sha256.Sum256(tmp[:])
	c2 := tmp2[0:4]

	if !FastByteArrayEq(c1, c2) {
		err = fmt.Errorf("Bad checksum: %v != %v", c1, c2)
	}
	return
}
