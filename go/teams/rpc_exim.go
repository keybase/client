// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// Export-Import for RPC for Teams

package teams

import (
	"golang.org/x/net/context"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func (t *Team) ExportToTeamPlusApplicationKeys(ctx context.Context, idTime keybase1.Time, application keybase1.TeamApplication) (ret keybase1.TeamPlusApplicationKeys, err error) {
	applicationKeys, err := t.AllApplicationKeys(ctx, application)
	if err != nil {
		return ret, err
	}

	members, err := t.Members()
	if err != nil {
		return ret, err
	}

	var writers []keybase1.UserVersion
	var onlyReaders []keybase1.UserVersion

	writers = append(writers, members.Writers...)
	writers = append(writers, members.Admins...)
	writers = append(writers, members.Owners...)
	onlyReaders = append(onlyReaders, members.Readers...)

	ret = keybase1.TeamPlusApplicationKeys{
		Id:              t.chain().GetID(),
		Name:            t.Name().String(),
		Implicit:        t.IsImplicit(),
		Public:          t.IsPublic(),
		Application:     application,
		Writers:         writers,
		OnlyReaders:     onlyReaders,
		ApplicationKeys: applicationKeys,
	}

	return ret, nil
}
