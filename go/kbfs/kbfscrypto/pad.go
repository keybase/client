// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfscrypto

import (
	"encoding/binary"
	"io"

	"github.com/pkg/errors"
)

const (
	padPrefixSize = 4
	minBlockSize  = 256
)

// powerOfTwoEqualOrGreater returns smallest power of 2 greater than or equal
// to the input n.
// https://en.wikipedia.org/wiki/Power_of_two#Algorithm_to_round_up_to_power_of_two
func powerOfTwoEqualOrGreater(n int) int {
	if n <= minBlockSize {
		return minBlockSize
	}
	if n&(n-1) == 0 {
		// if n is already power of 2, return it
		return n
	}

	n--
	n |= (n >> 1)
	n |= (n >> 2)
	n |= (n >> 4)
	n |= (n >> 8)
	n |= (n >> 16)
	n |= (n >> 16 >> 16) // make it work with 64 bit int; no effect on 32bit.
	n++

	return n
}

// PadBlock adds zero padding to an encoded block.
func PadBlock(block []byte) ([]byte, error) {
	totalLen := powerOfTwoEqualOrGreater(len(block))

	buf := make([]byte, padPrefixSize+totalLen)
	binary.LittleEndian.PutUint32(buf, uint32(len(block)))

	copy(buf[padPrefixSize:], block)
	return buf, nil
}

// DepadBlock extracts the actual block data from a padded block.
func DepadBlock(paddedBlock []byte) ([]byte, error) {
	totalLen := len(paddedBlock)
	if totalLen < padPrefixSize {
		return nil, errors.WithStack(io.ErrUnexpectedEOF)
	}

	blockLen := binary.LittleEndian.Uint32(paddedBlock)
	blockEndPos := int(blockLen + padPrefixSize)

	if totalLen < blockEndPos {
		return nil, errors.WithStack(
			PaddedBlockReadError{
				ActualLen:   totalLen,
				ExpectedLen: blockEndPos,
			})
	}
	return paddedBlock[padPrefixSize:blockEndPos], nil
}
