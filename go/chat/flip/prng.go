package flip

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/binary"
	"math/big"
)

type PRNG struct {
	key Secret
	buf []byte
	i   uint64
}

func NewPRNG(s Secret) *PRNG {
	return &PRNG{
		key: s,
		i:   uint64(1),
	}
}

func uint64ToSlice(i uint64) []byte {
	var ret [8]byte
	binary.BigEndian.PutUint64(ret[:], i)
	return ret[:]
}

func min(x, y int) int {
	if x < y {
		return x
	}
	return y
}

func (p *PRNG) read(ret []byte) int {
	n := min(len(p.buf), len(ret))
	copy(ret[0:n], p.buf[0:n])
	p.buf = p.buf[n:]
	return n
}

func (p *PRNG) replenish() {
	if len(p.buf) == 0 {
		hm := hmac.New(sha256.New, p.key[:])
		hm.Write(uint64ToSlice(p.i))
		p.buf = hm.Sum(nil)
		p.i++
	}
}

func (p *PRNG) Read(out []byte) int {
	var nRead int
	i := 0
	for nRead < len(out) {
		p.replenish()
		tmp := p.read(out[nRead:])
		nRead += tmp
		i++
	}
	return nRead
}

func (p *PRNG) Big(modulus *big.Int) *big.Int {

	sign := modulus.Sign()
	var n big.Int
	n.Abs(modulus)
	bits := n.BitLen()

	// For a modulus n, we want to clear out the bits that are
	// greater than the greatest bit of n. So compute 2^(ceil(log2(n)))-1,
	// and AND our candidate with that mask. That'll get rid of the
	// bits we don't want.
	var mask big.Int
	mask.Lsh(big.NewInt(1), uint(bits))
	mask.Sub(&mask, big.NewInt(1))

	// Compute the number of bytes it takes to get that many bits.
	// but rounding up.
	bytes := bits / 8
	if bits%8 != 0 {
		bytes++
	}

	buf := make([]byte, bytes)
	for {
		p.Read(buf)
		var x big.Int
		x.SetBytes(buf)
		x.And(&x, &mask)
		if x.Cmp(&n) < 0 {
			return x.Mul(&x, big.NewInt(int64(sign)))
		}
	}
}

func (p *PRNG) Int(modulus int64) int64 {
	return p.Big(big.NewInt(modulus)).Int64()
}

func (p *PRNG) Bool() bool {
	var b [1]byte
	p.Read(b[:])
	var ret bool
	if b[0]&0x1 == byte(1) {
		ret = true
	}
	return ret
}

func (p *PRNG) Permutation(n int) []int {
	ret := make([]int, n)
	for i := 0; i < n; i++ {
		ret[i] = i
	}
	for i := n - 1; i >= 1; i-- {
		j := p.Int(int64(i))
		ret[j], ret[i] = ret[i], ret[j]
	}
	return ret
}
