// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkb

import (
	"bytes"
	"fmt"
	"math/big"
)

var alphabet = []byte("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz")
var alphabetMap map[byte]uint8

func getAlphabetMap() map[byte]uint8 {
	if alphabetMap == nil {
		alphabetMap = make(map[byte]uint8)
		for i, c := range []byte(alphabet) {
			alphabetMap[c] = uint8(i)
		}
	}
	return alphabetMap
}

func reverseBuf(buf []byte) {
	tot := len(buf)
	mid := tot / 2
	for i := 0; i < mid; i++ {
		buf[i], buf[tot-i-1] = buf[tot-i-1], buf[i]
	}
}

func Encode58(inp []byte) string {
	num := new(big.Int).SetBytes(inp)
	buf := make([]byte, 0, len(inp))
	base := big.NewInt(int64(58))
	rem := new(big.Int)
	quo := new(big.Int)

	for num.Sign() != 0 {
		num, rem = quo.QuoRem(num, base, rem)
		c := alphabet[rem.Uint64()]
		buf = append(buf, c)
	}

	// Pad leading zeros...
	for _, c := range inp {
		if c == 0x0 {
			buf = append(buf, alphabet[0])
		} else {
			// Stop adding padding after the first nonzero byte.
			break
		}
	}
	reverseBuf(buf)

	return string(buf)
}

func Decode58(inp string) (outp []byte, err error) {
	place := big.NewInt(1)
	base := big.NewInt(58)
	buf := []byte(inp)
	padlen := 0

	// Advance to first non-pad byte
	for ; padlen < len(buf); padlen++ {
		if buf[padlen] != alphabet[0] {
			break
		}
	}
	buf = buf[padlen:]
	reverseBuf(buf)

	amap := getAlphabetMap()

	tmp := new(big.Int)
	res := big.NewInt(0)

	for i, c := range buf {
		charIndex, found := amap[c]
		if !found {
			err = fmt.Errorf("Bad character '%c' found at pos %d", c, i)
			return
		}

		tmp.Mul(place, big.NewInt(int64(charIndex)))
		res.Add(res, tmp)

		if i != len(buf)-1 {
			place.Mul(place, base)
		}
	}
	buf = res.Bytes()
	pad := bytes.Repeat([]byte{0}, padlen)
	outp = append(pad, buf...)

	return
}
