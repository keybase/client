package basex

import (
	"bytes"
	"errors"
	"fmt"
	"math"
	"math/big"
)

// An Encoding is a radix X encoding/decoding scheme, defined by X-length
// character alphabet.
type Encoding struct {
	encode      []byte
	decodeMap   [256]byte
	inBlockLen  int
	outBlockLen int
	base        int
	logOfBase   float64
	baseBig     *big.Int
}

// NewEncoding returns a new Encoding defined by the given alphabet,
// which must a x-byte string. No padding options are currently allowed.
// inBlock is the size of input blocks to consider.
//
// For base 58, we recommend 19-byte
// input blocks, which encode to 26-byte output blocks with only .3 bits
// wasted per block. The name of the game is to find a good rational
// approximation of 8/log2(58), and 26/19 is pretty good!
func NewEncoding(encoder string, inBlockLen int) *Encoding {

	base := len(encoder)

	logOfBase := math.Log2(float64(base))

	// If input blocks are inBlockLen size, compute the corresponding
	// output block length.  We need to round up to fit the overflow.
	outBlockLen := int(math.Ceil(float64(8*inBlockLen) / logOfBase))

	// Code adapted from encoding/base64/base64.go in the standard
	// Go libraries.
	e := &Encoding{
		encode:      make([]byte, base),
		base:        base,
		inBlockLen:  inBlockLen,
		outBlockLen: outBlockLen,
		logOfBase:   logOfBase,
		baseBig:     big.NewInt(int64(base)),
	}
	copy(e.encode[:], encoder)

	for i := 0; i < len(e.decodeMap); i++ {
		e.decodeMap[i] = 0xFF
	}
	for i := 0; i < len(encoder); i++ {
		e.decodeMap[encoder[i]] = byte(i)
	}
	return e
}

/*
 * Encoder
 */

// Encode encodes src using the encoding enc, writing
// EncodedLen(len(src)) bytes to dst.
//
// The encoding aligns the input along inBlockLen boundaries.
// so Encode is not appropriate for use on individual blocks
// of a large data stream.  Use NewEncoder() instead.
func (enc *Encoding) Encode(dst, src []byte) {
	for sp, dp, sLim, dLim := 0, 0, 0, 0; sp < len(src); sp, dp = sLim, dLim {
		sLim = sp + enc.inBlockLen
		dLim = dp + enc.outBlockLen
		if sLim > len(src) {
			sLim = len(src)
		}
		if dLim > len(dst) {
			dLim = len(dst)
		}
		enc.encodeBlock(dst[dp:dLim], src[sp:sLim])
	}
}

// encodeBlock fills the dst buffer with the encoding of src.
// It is assumed the buffers are appropriately sized, and no
// bounds checks are performed.  In particular, the dst buffer will
// be zero-padded from right to left in all remaining bytes.
func (enc *Encoding) encodeBlock(dst, src []byte) {
	num := new(big.Int).SetBytes(src)
	rem := new(big.Int)
	quo := new(big.Int)

	p := enc.EncodedLen(len(src)) - 1

	for num.Sign() != 0 {
		num, rem = quo.QuoRem(num, enc.baseBig, rem)
		dst[p] = enc.encode[rem.Uint64()]
		p--
	}

	// Pad the remainder of the buffer with 0s
	for p >= 0 {
		dst[p] = enc.encode[0]
		p--
	}
}

// DecodeStrict decodes src using the encoding enc.  It writes at most
// DecodedLen(len(src)) bytes to dst and returns the number of bytes
// written.  If src contains invalid baseX data, it will return the
// number of bytes successfully written and CorruptInputError.  It can
// also return an ErrInvalidEncodingLength error if there is a non-standard
// number of bytes in this encoding
func (enc *Encoding) DecodeStrict(dst, src []byte) (n int, err error) {
	return enc.decode(dst, src, true)
}

func (enc *Encoding) decode(dst []byte, src []byte, strict bool) (n int, err error) {
	dp, sp := 0, 0
	for sp < len(src) {
		di, si, err := enc.decodeBlock(dst[dp:], src[sp:], sp, strict)
		if err != nil {
			return 0, err
		}
		sp += si
		dp += di
	}
	return dp, nil
}

// Decode is like DecodeStrict, but first strips out all non-alphabet characters
func (enc *Encoding) Decode(dst, src []byte) (n int, err error) {
	return enc.decode(dst, src, false)
}

// CorruptInputError is returned when Decode() finds a non-alphabet character
type CorruptInputError int

// Error fits the error interface
func (e CorruptInputError) Error() string {
	return fmt.Sprintf("illegal data at input byte %d", int(e))
}

// ErrInvalidEncodingLength is returned when a non-minimal encoding length is found
var ErrInvalidEncodingLength = errors.New("invalid encoding length; either truncated or has trailing garbage")

func (enc *Encoding) decodeBlock(dst []byte, src []byte, baseOffset int, strict bool) (int, int, error) {
	si := 0 // source index
	numGoodChars := 0
	res := new(big.Int)

	for i, b := range src {
		v := enc.decodeMap[b]
		si++

		if v == 0xFF {
			if strict {
				return 0, 0, CorruptInputError(i + baseOffset)
			}
			continue
		}

		numGoodChars++
		res.Mul(res, enc.baseBig)
		res.Add(res, big.NewInt(int64(v)))

		if numGoodChars == enc.outBlockLen {
			break
		}
	}

	if !enc.IsValidEncodingLength(numGoodChars) {
		return 0, 0, ErrInvalidEncodingLength
	}

	raw := res.Bytes()
	paddedLen := enc.DecodedLen(numGoodChars)
	p := 0
	if len(raw) < paddedLen {
		p = paddedLen - len(raw)
		copy(dst, bytes.Repeat([]byte{0}, p))
	}
	copy(dst[p:paddedLen], raw)
	return paddedLen, si, nil
}

// EncodedLen returns the length in bytes of the baseX encoding
// of an input buffer of length n
func (enc *Encoding) EncodedLen(n int) int {

	// Fast path!
	if n == enc.inBlockLen {
		return enc.outBlockLen
	}

	nblocks := n / enc.inBlockLen
	out := nblocks * enc.outBlockLen
	rem := n % enc.inBlockLen
	if rem > 0 {
		out += int(math.Ceil(float64(rem*8) / enc.logOfBase))
	}
	return out
}

// DecodedLen returns the length in bytes of the baseX decoding
// of an input buffer of length n
func (enc *Encoding) DecodedLen(n int) int {

	// Fast path!
	if n == enc.outBlockLen {
		return enc.inBlockLen
	}

	nblocks := n / enc.outBlockLen
	out := nblocks * enc.inBlockLen
	rem := n % enc.outBlockLen
	if rem > 0 {
		out += int(math.Floor(float64(rem) * enc.logOfBase / float64(8)))
	}
	return out
}

// IsValidEncodingLength returns true if this block has a valid encoding length.
// An encoding length is invalid if a short encoding would have sufficed.
func (enc *Encoding) IsValidEncodingLength(n int) bool {
	// Fast path!
	if n == enc.outBlockLen {
		return true
	}
	f := func(n int) int {
		return int(math.Floor(float64(n) * enc.logOfBase / float64(8)))
	}
	if f(n) == f(n-1) {
		return false
	}
	return true
}
