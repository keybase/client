package stellar

import (
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/stellar/go/build"
)

// Options holds dynamic options for clients to use when preparing
// stellar transactions.
type Options struct {
	network stellar1.NetworkOptions
	mtime   time.Time
	sync.Mutex
}

func NewOptions() *Options {
	return &Options{}
}

// NetworkOptions returns stellar1.NetworkOptions that is less than 1 hour old.
func (o *Options) NetworkOptions(mctx libkb.MetaContext, r remote.Remoter) stellar1.NetworkOptions {
	o.Lock()
	defer o.Unlock()

	if time.Since(o.mtime) < 1*time.Hour {
		return o.network
	}

	options, err := r.NetworkOptions(mctx.Ctx())
	if err != nil {
		mctx.Debug("error calling NetworkOptions: %s", err)
	} else {
		mctx.Debug("updating NetworkOptions: %+v", options)
		o.network = options
		o.mtime = time.Now()
	}

	return o.network
}

func (o *Options) BaseFee(mctx libkb.MetaContext, r remote.Remoter) uint64 {
	options := o.NetworkOptions(mctx, r)
	if options.BaseFee < build.DefaultBaseFee {
		return build.DefaultBaseFee
	}
	return options.BaseFee
}
