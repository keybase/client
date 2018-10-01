package pipeliner

import (
	"golang.org/x/net/context"
	"sync"
)

// Pipeliner coordinates a flow of parallel requests, rate-limiting so that
// only a fixed number are oustanding at any one given time.
type Pipeliner struct {
	sync.RWMutex
	window int
	numOut int
	ch     chan struct{}
	err    error
}

// NewPipeliner makes a pipeliner with window size `w`.
func NewPipeliner(w int) *Pipeliner {
	return &Pipeliner{
		window: w,
		ch:     make(chan struct{}),
	}
}

func (p *Pipeliner) getError() error {
	p.RLock()
	defer p.RUnlock()
	return p.err
}

func (p *Pipeliner) hasRoom() bool {
	p.RLock()
	defer p.RUnlock()
	return p.numOut < p.window
}

func (p *Pipeliner) launchOne() {
	p.Lock()
	defer p.Unlock()
	p.numOut++
}

// WaitForRoom will block until there is room in the window to fire
// another request. It returns an error if any prior request failed,
// instructing the caller to stop firing off new requests. The error
// originates either from CompleteOne(), or from a context-based
// cancelation
func (p *Pipeliner) WaitForRoom(ctx context.Context) error {
	for {
		p.checkContextDone(ctx)
		if err := p.getError(); err != nil {
			return err
		}
		if p.hasRoom() {
			break
		}
		p.wait(ctx)
	}
	p.launchOne()
	return nil
}

// CompleteOne should be called when a request is completed, to make
// room for subsequent requests. Call it with an error if you want the
// rest of the pipeline to be short-circuited. This is the error that
// is returned from WaitForRoom.
func (p *Pipeliner) CompleteOne(e error) {
	p.setError(e)
	p.landOne()
	p.ch <- struct{}{}
}

func (p *Pipeliner) landOne() {
	p.Lock()
	defer p.Unlock()
	p.numOut--
}

func (p *Pipeliner) hasOutstanding() bool {
	p.RLock()
	defer p.RUnlock()
	return p.numOut > 0
}

func (p *Pipeliner) setError(e error) {
	p.Lock()
	defer p.Unlock()
	if e != nil && p.err == nil {
		p.err = e
	}
}

func (p *Pipeliner) checkContextDone(ctx context.Context) {
	select {
	case <-ctx.Done():
		p.setError(ctx.Err())
	default:
	}
}

func (p *Pipeliner) wait(ctx context.Context) {
	select {
	case <-p.ch:
	case <-ctx.Done():
		p.setError(ctx.Err())
	}
}

// Flush any oustanding requests, blocking until the last completes.
// Returns an error set by CompleteOne, or a context-based error
// if any request was canceled mid-flight.
func (p *Pipeliner) Flush(ctx context.Context) error {
	for {
		p.checkContextDone(ctx)
		if err := p.getError(); err != nil {
			return err
		}
		if !p.hasOutstanding() {
			break
		}
		p.wait(ctx)
	}
	return p.getError()
}
