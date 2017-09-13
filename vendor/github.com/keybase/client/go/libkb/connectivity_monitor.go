package libkb

import (
	context "golang.org/x/net/context"
)

type NullConnectivityMonitor struct {
}

func (s NullConnectivityMonitor) IsConnected(ctx context.Context) ConnectivityMonitorResult {
	return ConnectivityMonitorYes
}

func (s NullConnectivityMonitor) CheckReachability(ctx context.Context) error {
	return nil
}

var _ ConnectivityMonitor = NullConnectivityMonitor{}
