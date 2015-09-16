package libkbfs

import (
	metrics "github.com/rcrowley/go-metrics"
	"golang.org/x/net/context"
)

// BlockServerMeasured delegates to another BlockServer instance but
// also keeps track of stats.
type BlockServerMeasured struct {
	delegate                  BlockServer
	getTimer                  metrics.Timer
	putTimer                  metrics.Timer
	addBlockReferenceTimer    metrics.Timer
	removeBlockReferenceTimer metrics.Timer
}

var _ BlockServer = BlockServerMeasured{}

// NewBlockServerMeasured creates and returns a new
// BlockServerMeasured instance with the given delegate and registry.
func NewBlockServerMeasured(delegate BlockServer, r metrics.Registry) BlockServerMeasured {
	getTimer := metrics.GetOrRegisterTimer("BlockServer.Get", r)
	putTimer := metrics.GetOrRegisterTimer("BlockServer.Put", r)
	addBlockReferenceTimer := metrics.GetOrRegisterTimer("BlockServer.AddBlockReference", r)
	removeBlockReferenceTimer := metrics.GetOrRegisterTimer("BlockServer.RemoveBlockReference", r)
	return BlockServerMeasured{
		delegate:                  delegate,
		getTimer:                  getTimer,
		putTimer:                  putTimer,
		addBlockReferenceTimer:    addBlockReferenceTimer,
		removeBlockReferenceTimer: removeBlockReferenceTimer,
	}
}

// Get implements the BlockServer interface for BlockServerMeasured.
func (b BlockServerMeasured) Get(ctx context.Context, id BlockID,
	context BlockContext) (
	buf []byte, serverHalf BlockCryptKeyServerHalf, err error) {
	b.getTimer.Time(func() {
		buf, serverHalf, err = b.delegate.Get(ctx, id, context)
	})
	return buf, serverHalf, err
}

// Put implements the BlockServer interface for BlockServerMeasured.
func (b BlockServerMeasured) Put(ctx context.Context, id BlockID, tlfID TlfID,
	context BlockContext, buf []byte,
	serverHalf BlockCryptKeyServerHalf) (err error) {
	b.putTimer.Time(func() {
		err = b.delegate.Put(ctx, id, tlfID, context, buf, serverHalf)
	})
	return err
}

// AddBlockReference implements the BlockServer interface for
// BlockServerMeasured.
func (b BlockServerMeasured) AddBlockReference(ctx context.Context, id BlockID,
	tlfID TlfID, context BlockContext) (err error) {
	b.addBlockReferenceTimer.Time(func() {
		err = b.delegate.AddBlockReference(ctx, id, tlfID, context)
	})
	return err
}

// RemoveBlockReference implements the BlockServer interface for
// BlockServerMeasured.
func (b BlockServerMeasured) RemoveBlockReference(ctx context.Context, id BlockID,
	tlfID TlfID, context BlockContext) (err error) {
	b.removeBlockReferenceTimer.Time(func() {
		err = b.delegate.RemoveBlockReference(ctx, id, tlfID, context)
	})
	return err
}

// Shutdown implements the BlockServer interface for
// BlockServerMeasured.
func (b BlockServerMeasured) Shutdown() {
	b.delegate.Shutdown()
}
