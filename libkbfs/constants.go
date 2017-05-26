// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import "time"

// RPCReconnectInterval specifies the time between reconnect attempts for RPC Connections.
const RPCReconnectInterval = 2 * time.Second

// rekeyRecheckInterval is the time duration to wait for before rechecking for
// rekey for the same TLF. See fbo.Rekey for more details.
const rekeyRecheckInterval = 30 * time.Second

// rekeyInitialTTL is the maximum number rechecks each rekey request can trigger.
const rekeyInitialTTL = 4

// mdserverReconnectBackoffWindow is a backoff window within which we try to
// wait randomly for before reconnecting to MD server.
// TODO: increase this to 5 min
const mdserverReconnectBackoffWindow = 30 * time.Second

// registerForUpdatesFireNowThreshold is the maximum length of time that
// KBFS can be idle for, in order to trigger FireNow from RegisterForUpdate.
const registerForUpdatesFireNowThreshold = 10 * time.Minute
