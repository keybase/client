package uidmap

import (
	"bytes"
	"compress/zlib"
	"fmt"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"io"
	"sort"
	"sync"
)

var offsets []uint32
var usernames []byte
var once sync.Once

func findInit() {
	once.Do(func() {
		initUsernameOffsets()
		initUsernames()
	})
}

type bufWriter struct {
	b []byte
	n int
}

func (b *bufWriter) Write(p []byte) (int, error) {
	copy(b.b[b.n:], p)
	b.n += len(p)
	return len(p), nil
}

func initUsernameOffsets() {
	var offset uint32
	offsets = make([]uint32, len(lengths), len(lengths))
	for index, length := range lengths {
		offsets[index] = offset
		offset += uint32(length)
	}
}

func initUsernames() {
	//
	// The list of usernames is computed as such:
	//  1. Sort all exceptions by UID
	//  2. concatenate all username strings after sorting in 1
	//  3. Tolower the blob
	//  4. run through zlib
	//  5. Also, along with (2), record the lenght of all of the usernames, and insert into an array
	//  6. Compute running offsets by cumsum'ing the values in 5.
	//
	zip, err := zlib.NewReader(bytes.NewReader(usernamesCompressed[:]))
	if err != nil {
		panic(err)
	}
	usernames = make([]byte, usernamesLen, usernamesLen)
	buf := bufWriter{usernames, 0}
	n, err := io.Copy(&buf, zip)
	if err != nil {
		panic(err)
	}
	if n != usernamesLen {
		panic(fmt.Sprintf("bad expansion: wanted %d bytes but got %d", usernamesLen, n))
	}
	zip.Close()
}

func findHardcoded(uid keybase1.UID) libkb.NormalizedUsername {
	findInit()
	searchFor := uid.ToBytes()
	uidLen := len(searchFor)
	l := len(uids) / uidLen
	uidAt := func(i int) []byte {
		start := i * uidLen
		return uids[start : start+uidLen]
	}
	doCmp := func(i int) int {
		return bytes.Compare(searchFor, uidAt(i))
	}
	n := sort.Search(l, func(i int) bool {
		return doCmp(i) <= 0
	})
	if n == l || doCmp(n) != 0 {
		return libkb.NormalizedUsername("")
	}
	offset := offsets[n]
	s := string(usernames[offset : offset+uint32(lengths[n])])
	return libkb.NewNormalizedUsername(s)
}

func checkUIDAgainstUsername(uid keybase1.UID, un libkb.NormalizedUsername) bool {
	found := findHardcoded(uid)
	if !found.IsNil() {
		return found.Eq(un)
	}
	computed := libkb.UsernameToUID(un.String())
	return computed.Equal(uid)
}
