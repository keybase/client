package libkb

import (
	"github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

type DummyRuntimeStats struct{}

var _ RuntimeStats = (*DummyRuntimeStats)(nil)

func NewDummyRuntimeStats() *DummyRuntimeStats {
	return &DummyRuntimeStats{}
}

func (d *DummyRuntimeStats) Start(context.Context)              {}
func (d *DummyRuntimeStats) Stop(context.Context) chan struct{} { return nil }
func (d *DummyRuntimeStats) PushPerfEvent(keybase1.PerfEvent)   {}
