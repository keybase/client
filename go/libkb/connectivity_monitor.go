package libkb

import (
	context "golang.org/x/net/context"
)

type NullConnectivityMonitor struct {
}

func (s NullConnectivityMonitor) IsConnected(ctx context.Context) ConnectivityMonitorResult {
	return ConnectivityMonitor_YES
}

var _ ConnectivityMonitor = NullConnectivityMonitor{}
