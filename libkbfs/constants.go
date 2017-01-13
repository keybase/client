// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import "time"

// RPCReconnectInterval specifies the time between reconnect attempts for RPC Connections.
const RPCReconnectInterval = 2 * time.Second
