package libkb

import (
	context "golang.org/x/net/context"
)

type NullConnectivityMonitor struct {
}

func (s NullConnectivityMonitor) IsConnected(ctx context.Context) ConnectivityMonitorResult {
	return ConnectivityMonitorYes
}

var _ ConnectivityMonitor = NullConnectivityMonitor{}
