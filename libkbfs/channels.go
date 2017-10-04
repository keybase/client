package libkbfs

import (
	"sync"

	"github.com/eapache/channels"
)

const (
	defaultInfiniteBufferSize int = 100
)

// infiniteChannelWrapper is a wrapper to allow us to select on sending to an
// infinite channel without fearing a panic when we Close() it.
type infiniteChannelWrapper struct {
	*channels.InfiniteChannel
	input        chan interface{}
	shutdownOnce sync.Once
	shutdownCh   chan struct{}
}

var _ channels.Channel = (*infiniteChannelWrapper)(nil)

func newInfiniteChannelWrapper() *infiniteChannelWrapper {
	ch := &infiniteChannelWrapper{
		InfiniteChannel: channels.NewInfiniteChannel(),
		input:           make(chan interface{}, defaultInfiniteBufferSize),
		shutdownCh:      make(chan struct{}),
	}
	go ch.run()
	return ch
}

func (ch *infiniteChannelWrapper) run() {
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

func (ch *infiniteChannelWrapper) In() chan<- interface{} {
	return ch.input
}

func (ch *infiniteChannelWrapper) Close() {
	ch.shutdownOnce.Do(func() {
		close(ch.shutdownCh)
	})
}
