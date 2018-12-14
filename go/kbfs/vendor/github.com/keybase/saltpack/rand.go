// Copyright (c) 2009 The Go Authors. All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
//    * Redistributions of source code must retain the above copyright
// notice, this list of conditions and the following disclaimer.
//    * Redistributions in binary form must reproduce the above
// copyright notice, this list of conditions and the following disclaimer
// in the documentation and/or other materials provided with the
// distribution.
//    * Neither the name of Google Inc. nor the names of its
// contributors may be used to endorse or promote products derived from
// this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// (Following the advice of
// https://softwareengineering.stackexchange.com/a/264363 re. above
// copyright notices.)

package saltpack

import (
	cryptorand "crypto/rand"
	"encoding/binary"
	"io"
)

// csprngReadFull is a thin wrapper around io.ReadFull on a given
// CSPRNG that also (paranoidly) checks the length.
func csprngReadFull(csprng io.Reader, b []byte) error {
	n, err := io.ReadFull(csprng, b)
	if err != nil {
		return err
	}
	if n != len(b) {
		return ErrInsufficientRandomness
	}
	return nil
}

// csprngRead is like crypto/rand.Read, except it uses csprngReadFull
// instead of io.ReadFull.
func csprngRead(b []byte) error {
	return csprngReadFull(cryptorand.Reader, b)
}

// csprngUint32, given a CSPRNG, returns a uniformly distributed
// random number in [0, 2³²).
func csprngUint32(csprng io.Reader) (uint32, error) {
	var buf [4]byte
	err := csprngReadFull(csprng, buf[:])
	if err != nil {
		return 0, err
	}

	return binary.BigEndian.Uint32(buf[:]), nil
}

// csprngUint32n, given a CSPRNG, returns, as a uint32, a uniformly
// distributed random number in [0, n). It is adapted from
// math/rand.int31n from go 1.10.
//
// For implementation details, see:
// https://lemire.me/blog/2016/06/27/a-fast-alternative-to-the-modulo-reduction
// https://lemire.me/blog/2016/06/30/fast-random-shuffling
func csprngUint32n(csprng io.Reader, n uint32) (uint32, error) {
	v, err := csprngUint32(csprng)
	if err != nil {
		return 0, err
	}
	prod := uint64(v) * uint64(n)
	low := uint32(prod)
	if low < n {
		thresh := -n % n
		for low < thresh {
			v, err = csprngUint32(csprng)
			if err != nil {
				return 0, err
			}
			prod = uint64(v) * uint64(n)
			low = uint32(prod)
		}
	}
	return uint32(prod >> 32), nil
}

// csprngShuffle randomizes the order of elements given a CSPRNG. n is
// the number of elements, which must be >= 0 and < 2³¹. swap swaps
// the elements with indexes i and j.
//
// This function implements
// https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle , and is
// adapted from math/rand.Shuffle from go 1.10.
func csprngShuffle(csprng io.Reader, n int, swap func(i, j int)) error {
	if n < 0 {
		panic("csprngShuffle: n < 0")
	}
	if n > ((1 << 31) - 1) {
		panic("csprngShuffle: n >= 2³¹")
	}

	for i := n - 1; i > 0; i-- {
		j, err := csprngUint32n(csprng, uint32(i+1))
		if err != nil {
			return err
		}
		swap(i, int(j))
	}
	return nil
}
