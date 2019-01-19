// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package cache

import (
	"math"
	"reflect"
)

/*

Following struct/const definitions are from src/runtime/hashmap.go. We don't
use them directly, but the estimation of map size is based on them.

const (
	// Maximum number of key/value pairs a bucket can hold.
  	bucketCntBits = 3
  	bucketCnt     = 1 << bucketCntBits

	// Maximum average load of a bucket that triggers growth.
	loadFactor = 6.5
	...
)

// A header for a Go map.
type hmap struct {
	// Note: the format of the Hmap is encoded in ../../cmd/internal/gc/reflect.go and
	// ../reflect/type.go. Don't change this structure without also changing that code!
	count     int // # live cells == size of map.  Must be first (used by len() builtin)
	flags     uint8
	B         uint8  // log_2 of # of buckets (can hold up to loadFactor * 2^B items)
	noverflow uint16 // approximate number of overflow buckets; see incrnoverflow for details
	hash0     uint32 // hash seed

	buckets    unsafe.Pointer // array of 2^B Buckets. may be nil if count==0.
	oldbuckets unsafe.Pointer // previous bucket array of half the size, non-nil only when growing
	nevacuate  uintptr        // progress counter for evacuation (buckets less than this have been evacuated)

	// If both key and value do not contain pointers and are inline, then we mark bucket
	// type as containing no pointers. This avoids scanning such maps.
	// However, bmap.overflow is a pointer. In order to keep overflow buckets
	// alive, we store pointers to all overflow buckets in hmap.overflow.
	// Overflow is used only if key and value do not contain pointers.
	// overflow[0] contains overflow buckets for hmap.buckets.
	// overflow[1] contains overflow buckets for hmap.oldbuckets.
	// The first indirection allows us to reduce static size of hmap.
	// The second indirection allows to store a pointer to the slice in hiter.
	overflow *[2]*[]*bmap
}

// A bucket for a Go map.
type bmap struct {
	// tophash generally contains the top byte of the hash value
	// for each key in this bucket. If tophash[0] < minTopHash,
	// tophash[0] is a bucket evacuation state instead.
	tophash [bucketCnt]uint8
	// Followed by bucketCnt keys and then bucketCnt values.
	// NOTE: packing all the keys together and then all the values together makes the
	// code a bit more complicated than alternating key/value/key/value/... but it allows
	// us to eliminate padding which would be needed for, e.g., map[int64]int8.
	// Followed by an overflow pointer.
}
*/

const (
	// MB is a short cut for 1024 * 1024.
	MB = 1024 * 1024

	// PtrSize is the number of bytes a pointer takes.
	PtrSize = 4 << (^uintptr(0) >> 63) // stolen from runtime/internal/sys
	// IntSize is the number of bytes an int or uint takes.
	IntSize = 4 << (^uint(0) >> 63)

	hmapStructSize = IntSize + // count int
		1 + 1 + 2 + 4 + // flags, B, noverflow, hash0
		PtrSize*3 + // buckets, oldbuckets, nevacuate
		PtrSize + 2*PtrSize // overflow (estimate; not counting the slice)

	bucketSizeWithoutIndirectPointerOverhead = 1 << 3 // tophash only

	mapLoadFactor = 6.5
)

func mapKeyOrValueSizeWithIndirectPointerOverhead(rawSize int) int {
	if rawSize > 128 {
		// In Go maps, if key or value is larger than 128 bytes, a pointer type
		// is used.
		return rawSize + PtrSize
	}
	return rawSize
}

// StaticSizeOfMap provides a best-effort estimate of number of bytes that a
// map takes in memory. It only includes statically sized content (i.e. struct,
// array, int types, pointer address itself, slice/map's reference address
// itself, etc.). If needed, dynamic sized stuff (slice/map content, pointer
// content should be calculated separately by caller.
func StaticSizeOfMap(
	zeroValueKey, zeroValueValue interface{}, count int) (bytes int) {
	return StaticSizeOfMapWithSize(int(reflect.TypeOf(zeroValueKey).Size()),
		int(reflect.TypeOf(zeroValueValue).Size()), count)
}

// StaticSizeOfMapWithSize is a slightly more efficient version of
// StaticSizeOfMap for when the caller knows the static size of key and value
// without having to use `reflect`.
func StaticSizeOfMapWithSize(
	keyStaticSize, valueStaticSize int, count int) (bytes int) {
	keySize := mapKeyOrValueSizeWithIndirectPointerOverhead(keyStaticSize)
	valueSize := mapKeyOrValueSizeWithIndirectPointerOverhead(valueStaticSize)

	// See the comment of `B` field of `hmap` struct above.
	B := math.Ceil(math.Log2(float64(count) / mapLoadFactor))
	numBuckets := int(math.Exp2(B))

	return hmapStructSize +
		bucketSizeWithoutIndirectPointerOverhead*numBuckets +
		(keySize+valueSize)*count
}
