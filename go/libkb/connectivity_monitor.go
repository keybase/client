package libkb

import (
	"context"
	"time"
)

type NullConnectivityMonitor struct{}

func (s NullConnectivityMonitor) IsConnected(ctx context.Context) ConnectivityMonitorResult {
	return ConnectivityMonitorYes
}

func (s NullConnectivityMonitor) ConnectedSince(ctx context.Context) (time.Time, bool) {
	return time.Time{}, false
}

func (s NullConnectivityMonitor) CheckReachability(ctx context.Context) error {
	return nil
}

var _ ConnectivityMonitor = NullConnectivityMonitor{}
