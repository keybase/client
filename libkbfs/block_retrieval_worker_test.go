// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"crypto/rand"
	"testing"

	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func makeFakeFileBlock(t *testing.T) *FileBlock {
	buf := make([]byte, 16)
	_, err := rand.Read(buf)
	require.NoError(t, err)
	return &FileBlock{
		Contents: buf,
	}
}

func TestBlockRetrievalWorkerBasic(t *testing.T) {
	q := newBlockRetrievalQueue(1)
	require.NotNil(t, q)

	bg := newFakeBlockGetter()
	w := newBlockRetrievalWorker(bg, q)
	require.NotNil(t, q)
	require.NotNil(t, w)

	ptr1 := makeFakeBlockPointer(t)
	block1 := makeFakeFileBlock(t)
	bg.setBlockToReturn(ptr1, block1)

	block := &FileBlock{}
	ch := q.Request(context.Background(), 1, ptr1, block)
	err := <-ch
	require.NoError(t, err)
	require.Equal(t, block1, block)
}
