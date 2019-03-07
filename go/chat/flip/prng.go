package flip

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/binary"
	"math/big"
)

// PRNG is based on AES-CTR. The input key is a 32-byte random secret (as generated
// by our commitment scheme). The output is a AES(k,1), AES(k,2), AES(k,3), etc...
// We are relying on the fact that AES is a PRP, which is pretty widely assumed.
type PRNG struct {
	key    Secret
	buf    []byte
	i      uint64
	cipher cipher.Block
}

func NewPRNG(s Secret) *PRNG {
	return &PRNG{
		key: s,
		i:   uint64(1),
	}
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

type block [16]byte

func (b *block) counter(i uint64) {
	binary.BigEndian.PutUint64(b[8:], i)
}

func (p *PRNG) getCipher() cipher.Block {
	if p.cipher == nil {
		var err error
		p.cipher, err = aes.NewCipher(p.key[:])
		if err != nil {
			panic(err.Error())
		}
		var tmp block
		if p.cipher.BlockSize() != len(tmp) {
			panic("Expected a 16-byte block size")
		}
	}
	return p.cipher
}

func (p *PRNG) replenish() {
	if len(p.buf) == 0 {
		var input block
		var output block
		input.counter(p.i)
		p.i++
		p.getCipher().Encrypt(output[:], input[:])
		p.buf = output[:]
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
	// For moduli of 0, the sign will be 0. Just return it, since there's
	// nothing we can really do.
	if sign == 0 {
		return modulus
	}

	// Find out how many bits are in numbers that are between 0 and |modulus|, exclusive.
	// To do this, we find the absolute value of modulus, store it into n, and ask
	// how many bits are in (n-1).
	var n big.Int
	n.Abs(modulus)
	var nMinus1 big.Int
	nMinus1.Sub(&n, big.NewInt(1))
	bits := nMinus1.BitLen()

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

// Permutation runs the Fisher-Yates shuffle on the sequence [0,n).
// See: https://en.wikipedia.org/wiki/Fisher–Yates_shuffle
// Be careful for off-by-one errors in this implementation, as we have
// already witnessed one. We bounty bugs like these, so let us know!
func (p *PRNG) Permutation(n int) []int {
	ret := make([]int, n)
	for i := 0; i < n; i++ {
		ret[i] = i
	}
	for i := n - 1; i >= 1; i-- {
		modulus := i + 1
		j := p.Int(int64(modulus))
		ret[j], ret[i] = ret[i], ret[j]
	}
	return ret
}
