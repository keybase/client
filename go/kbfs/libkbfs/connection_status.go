// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sync"
)

// Service names used in ConnectionStatus.
const (
	KeybaseServiceName     = "keybase-service"
	MDServiceName          = "md-server"
	GregorServiceName      = "gregor"
	LoginStatusUpdateName  = "login"
	LogoutStatusUpdateName = "logout"
)

type errDisconnected struct{}

func (errDisconnected) Error() string { return "Disconnected" }

type kbfsCurrentStatus struct {
	lock            sync.Mutex
	failingServices map[string]error
	invalidateChan  chan StatusUpdate
}

// Init inits the kbfsCurrentStatus.
func (kcs *kbfsCurrentStatus) Init() {
	kcs.failingServices = map[string]error{}
	kcs.invalidateChan = make(chan StatusUpdate)
}

// CurrentStatus returns a copy of the current status.
func (kcs *kbfsCurrentStatus) CurrentStatus() (map[string]error, chan StatusUpdate) {
	kcs.lock.Lock()
	defer kcs.lock.Unlock()

	res := map[string]error{}
	for k, v := range kcs.failingServices {
		res[k] = v
	}
	return res, kcs.invalidateChan
}

// PushConnectionStatusChange pushes a change to the connection status of one of the services.
func (kcs *kbfsCurrentStatus) PushConnectionStatusChange(service string, err error) {
	kcs.lock.Lock()
	defer kcs.lock.Unlock()

	if err != nil {
		// Exit early if the service is already failed, to avoid an
		// invalidation.
		_, errExisted := kcs.failingServices[service]
		kcs.failingServices[service] = err
		if errExisted {
			return
		}
	} else {
		// Potentially exit early if nothing changes.
		_, exist := kcs.failingServices[service]
		if !exist {
			return
		}
		delete(kcs.failingServices, service)
	}

	close(kcs.invalidateChan)
	kcs.invalidateChan = make(chan StatusUpdate)
}

// PushStatusChange forces a new status be fetched by status listeners.
func (kcs *kbfsCurrentStatus) PushStatusChange() {
	kcs.lock.Lock()
	defer kcs.lock.Unlock()
	close(kcs.invalidateChan)
	kcs.invalidateChan = make(chan StatusUpdate)
}
