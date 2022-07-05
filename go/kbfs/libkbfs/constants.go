// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"syscall"
	"time"
)

// RPCReconnectInterval specifies the time between reconnect attempts for RPC Connections.
const RPCReconnectInterval = 2 * time.Second

// rekeyRecheckInterval is the time duration to wait for before rechecking for
// rekey for the same TLF. See fbo.Rekey for more details.
const rekeyRecheckInterval = 30 * time.Second

// rekeyInitialTTL is the maximum number rechecks each rekey request can trigger.
const rekeyInitialTTL = 4

// mdserverFirstConnectDelay is the duration we wait for before we try to
// connect to mdserver for the first time..
const mdserverFirstConnectDelay = time.Second * 10

// mdserverReconnectBackoffWindow is a backoff window within which we try to
// wait randomly for before reconnecting to MD server.
const mdserverReconnectBackoffWindow = time.Hour

// bserverFirstConnectDelay is the duration we wait for before we try to
// connect to mdserver for the first time..
const bserverFirstConnectDelay = time.Second * 10

// bserverReconnectBackoffWindow is a backoff window within which we try to
// wait randomly for before reconnecting to bserver.
const bserverReconnectBackoffWindow = time.Hour

// registerForUpdatesFireNowThreshold is the maximum length of time that
// KBFS can be idle for, in order to trigger FireNow from RegisterForUpdate.
const registerForUpdatesFireNowThreshold = 10 * time.Minute

// dialerTimeout is the TCP dial timeout used by mdserver and bserver RPC
// connections.
const dialerTimeout = 16 * time.Second

// NonexistentSignal is a signal that will never be used by the OS.
const NonexistentSignal = syscall.Signal(-1)
