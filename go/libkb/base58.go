// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"fmt"
	"math/big"
)

const base58InvalidIndex = 0xFF

var alphabet = []byte("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz")
var alphabetMap = func() [256]byte {
	var res [256]byte
	// First initialize to 0xFF
	for i := range res {
		res[i] = base58InvalidIndex
	}
	// And reset the real contents to their values.
	for i, c := range alphabet {
		res[c] = uint8(i)
	}
	return res
}()

func reverseBuf(buf []byte) {
	tot := len(buf)
	mid := tot / 2
	for i := 0; i < mid; i++ {
		buf[i], buf[tot-i-1] = buf[tot-i-1], buf[i]
	}
}

// Encode58 base58 encodes the input.
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

// Decode58 base58 decodes the input or returns an error.
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

	tmp := new(big.Int)
	res := big.NewInt(0)

	for i, c := range buf {
		charIndex := alphabetMap[c]
		if charIndex == base58InvalidIndex {
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
