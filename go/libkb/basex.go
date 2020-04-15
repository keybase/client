// Copyright 2020 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"fmt"
	"math/big"
	"strconv"
)

const invalidBaseIndex = 0xFF

var Base30 = NewBaseX("abcdefghjkmnpqrsuvwxyz23456789")
var Base58 = NewBaseX("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz")

type BaseXEncoder struct {
	size        int
	base        *big.Int
	alphabet    string
	alphabetMap [256]byte
}

func NewBaseX(alphabet string) *BaseXEncoder {
	enc := &BaseXEncoder{
		size:     len(alphabet),
		base:     big.NewInt(int64(len(alphabet))),
		alphabet: alphabet,
	}
	if enc.size > 255 {
		panic("unsupported BaseX alphabet size, got " + strconv.Itoa(enc.size))
	}
	for i := range enc.alphabetMap {
		enc.alphabetMap[i] = invalidBaseIndex
	}
	for i, c := range alphabet {
		enc.alphabetMap[c] = uint8(i)
	}
	return enc
}

func reverseBuf(buf []byte) {
	tot := len(buf)
	mid := tot / 2
	for i := 0; i < mid; i++ {
		buf[i], buf[tot-i-1] = buf[tot-i-1], buf[i]
	}
}

func (b *BaseXEncoder) EncodeToString(input []byte) string {
	num := new(big.Int).SetBytes(input)
	buf := make([]byte, 0, len(input))
	rem := new(big.Int)
	quo := new(big.Int)

	for num.Sign() != 0 {
		num, rem = quo.QuoRem(num, b.base, rem)
		c := b.alphabet[rem.Uint64()]
		buf = append(buf, c)
	}

	// Pad leading zeros...
	for _, c := range input {
		if c == 0x0 {
			buf = append(buf, b.alphabet[0])
		} else {
			// Stop adding padding after the first nonzero byte.
			break
		}
	}
	reverseBuf(buf)

	return string(buf)
}

func (b *BaseXEncoder) DecodeString(inp string) (outp []byte, err error) {
	place := big.NewInt(1)
	buf := []byte(inp)
	padlen := 0

	// Advance to first non-pad byte
	for ; padlen < len(buf); padlen++ {
		if buf[padlen] != b.alphabet[0] {
			break
		}
	}
	buf = buf[padlen:]
	reverseBuf(buf)

	tmp := new(big.Int)
	res := big.NewInt(0)

	for i, c := range buf {
		charIndex := b.alphabetMap[c]
		if charIndex == invalidBaseIndex {
			err = fmt.Errorf("Bad character '%c' found at pos %d", c, i)
			return
		}

		tmp.Mul(place, big.NewInt(int64(charIndex)))
		res.Add(res, tmp)

		if i != len(buf)-1 {
			place.Mul(place, b.base)
		}
	}
	buf = res.Bytes()
	pad := bytes.Repeat([]byte{0}, padlen)
	outp = make([]byte, len(pad)+len(buf))
	copy(outp, pad)
	copy(outp[len(pad):], buf)

	return
}
