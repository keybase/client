// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package test

import (
	"bytes"
	"fmt"
	"testing"

	"github.com/keybase/kbfs/libkbfs"
)

type m map[string]string
type username string

const (
	alice = username("alice")
	bob   = username("bob")
	eve   = username("eve")
)

func ntimesString(n int, s string) string {
	var bs bytes.Buffer
	for i := 0; i < n; i++ {
		bs.WriteString(s)
	}
	return bs.String()
}

func concatUserNamesToStrings2(a, b []username) []string {
	userSlice := make([]string, 0, len(a)+len(b))
	for _, u := range a {
		userSlice = append(userSlice, string(u))
	}
	for _, u := range b {
		userSlice = append(userSlice, string(u))
	}
	return userSlice
}

func setBlockSizes(t *testing.T, config libkbfs.Config, blockSize, blockChangeSize int64) {
	// Set the block sizes, if any
	if blockSize > 0 || blockChangeSize > 0 {
		if blockSize == 0 {
			blockSize = 512 * 1024
		}
		if blockChangeSize < 0 {
			t.Fatal("Can't handle negative blockChangeSize")
		}
		if blockChangeSize == 0 {
			blockChangeSize = 8 * 1024
		}
		bsplit, err := libkbfs.NewBlockSplitterSimple(blockSize,
			uint64(blockChangeSize), config.Codec())
		if err != nil {
			t.Fatalf("Couldn't make block splitter for block size %d,"+
				" blockChangeSize %d: %v", blockSize, blockChangeSize, err)
		}
		config.SetBlockSplitter(bsplit)
	}
}

type optionOp func(*opt)

func blockSize(n int64) optionOp {
	return func(o *opt) {
		o.blockSize = n
	}
}

func blockChangeSize(n int64) optionOp {
	return func(o *opt) {
		o.blockChangeSize = n
	}
}

func writers(ns ...username) optionOp {
	return func(o *opt) {
		o.writerNames = append(o.writerNames, ns...)
	}
}

func readers(ns ...username) optionOp {
	return func(o *opt) {
		o.readerNames = append(o.readerNames, ns...)
	}
}

type fileOp struct {
	operation func(*ctx) error
	flags     fileOpFlags
}
type fileOpFlags uint32

const (
	Defaults = fileOpFlags(0)
	IsInit   = fileOpFlags(1)
)

func expectError(op fileOp, reason string) fileOp {
	return fileOp{func(c *ctx) error {
		err := op.operation(c)
		if err == nil {
			return fmt.Errorf("Didn't get expected error (success while expecting failure): %q", reason)
		}
		if err.Error() != reason {
			return fmt.Errorf("Got the wrong error: expected %q, got %q", reason, err.Error())
		}
		return nil
	}, Defaults}
}

func noSync() fileOp {
	return fileOp{func(c *ctx) error {
		c.noSyncInit = true
		return nil
	}, IsInit}
}
