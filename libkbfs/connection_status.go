package libkbfs

import (
	"sync"
)

// ConnectionStatus for changes in connection state.
type ConnectionStatus struct {
	// Service affected.
	Service string
	// Error or nil when the status changes to success.
	Error error
}

var connectionStatusListeners = make([]func(*ConnectionStatus), 0, 1)
var connectionStatusListenersLock sync.Mutex

// Service names used in ConnectionStatus.
const (
	KeybaseServiceName = "keybase-service"
	MDServiceName      = "md-server"
)

type errDisconnected struct{}

func (errDisconnected) Error() string { return "Disconnected" }

// RegisterForConnectionStatusChanges registers a callback for connection status changes.
func RegisterForConnectionStatusChanges(callback func(*ConnectionStatus)) {
	connectionStatusListenersLock.Lock()
	defer connectionStatusListenersLock.Unlock()
	connectionStatusListeners = append(connectionStatusListeners, callback)
}

func pushConnectionStatusChange(service string, err error) {
	cs := &ConnectionStatus{service, err}
	connectionStatusListenersLock.Lock()
	defer connectionStatusListenersLock.Unlock()
	for _, callback := range connectionStatusListeners {
		callback(cs)
	}
}
