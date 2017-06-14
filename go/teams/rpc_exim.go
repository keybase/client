// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// Export-Import for RPC for Teams

package teams

import (
	"golang.org/x/net/context"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func (t *Team) ExportToTeamPlusApplicationKeys(ctx context.Context, idTime keybase1.Time, application keybase1.TeamApplication) (teamPlusApplicationKeys keybase1.TeamPlusApplicationKeys, err error) {
	applicationKeys, err := t.AllApplicationKeys(ctx, application)
	if err != nil {
		return
	}

	members, err := t.Members()
	if err != nil {
		return
	}

	writers := make([]keybase1.UserVersion, 0)
	for _, writer := range members.Writers {
		writers = append(writers, writer)
	}

	writersSet := make(map[keybase1.UserVersion]bool, 0)
	for _, writer := range writers {
		writersSet[writer] = true
	}

	onlyReaders := make([]keybase1.UserVersion, 0)
	for _, reader := range members.Readers {
		_, ok := writersSet[reader]
		if !ok {
			onlyReaders = append(onlyReaders, reader)
		}
	}

	teamPlusApplicationKeys = keybase1.TeamPlusApplicationKeys{
		Id:              t.Chain.GetID(),
		Name:            t.Chain.GetName(),
		Application:     application,
		Writers:         writers,
		OnlyReaders:     onlyReaders,
		ApplicationKeys: applicationKeys,
	}

	return
}
