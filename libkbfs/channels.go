// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sync"

	"github.com/eapache/channels"
)

const (
	defaultInfiniteBufferSize int = 0
)

// InfiniteChannelWrapper is a wrapper to allow us to select on sending to an
// infinite channel without fearing a panic when we Close() it.
type InfiniteChannelWrapper struct {
	*channels.InfiniteChannel
	input        chan interface{}
	shutdownOnce sync.Once
	shutdownCh   chan struct{}
}

var _ channels.Channel = (*InfiniteChannelWrapper)(nil)

// NewInfiniteChannelWrapper returns a wrapper around a new infinite
// channel.
func NewInfiniteChannelWrapper() *InfiniteChannelWrapper {
	ch := &InfiniteChannelWrapper{
		InfiniteChannel: channels.NewInfiniteChannel(),
		input:           make(chan interface{}, defaultInfiniteBufferSize),
		shutdownCh:      make(chan struct{}),
	}
	go ch.run()
	return ch
}

func (ch *InfiniteChannelWrapper) run() {
	for {
		select {
		case next := <-ch.input:
			ch.InfiniteChannel.In() <- next
		case <-ch.shutdownCh:
			ch.InfiniteChannel.Close()
			return
		}
	}
}

// In returns the input channel for this infinite channel.
func (ch *InfiniteChannelWrapper) In() chan<- interface{} {
	return ch.input
}

// Close shuts down this infinite channel.
func (ch *InfiniteChannelWrapper) Close() {
	ch.shutdownOnce.Do(func() {
		close(ch.shutdownCh)
	})
}
