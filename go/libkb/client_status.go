// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func GetClientStatus(mctx MetaContext) (res []keybase1.ClientStatus) {
	if mctx.G().ConnectionManager != nil {
		res = mctx.G().ConnectionManager.ListAllLabeledConnections()
		for i, client := range res {
			res[i].NotificationChannels = mctx.G().NotifyRouter.GetChannels(ConnectionID(client.ConnectionID))
		}
	}
	return res
}
