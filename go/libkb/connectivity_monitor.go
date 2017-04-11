package libkb

import (
	context "golang.org/x/net/context"
)

type NullConnectivityMonitor struct {
}

func (s NullConnectivityMonitor) IsConnected(ctx context.Context) bool {
	return true
}

var _ ConnectivityMonitor = NullConnectivityMonitor{}
