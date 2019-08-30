// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// Export-Import for RPC for Teams

package teams

import (
	"golang.org/x/net/context"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func (t *Team) ExportToTeamPlusApplicationKeys(ctx context.Context, idTime keybase1.Time,
	application keybase1.TeamApplication, includeKBFSKeys bool) (ret keybase1.TeamPlusApplicationKeys, err error) {
	loadKeys := true
	if t.IsPublic() {
		// If it's a public team, only try to load application keys if
		// we are a member. If we are not, we should still be able to
		// get team details using this func (and get an empty key list).
		role, err := t.myRole(ctx)
		loadKeys = err == nil && role != keybase1.TeamRole_NONE
	}

	var applicationKeys []keybase1.TeamApplicationKey
	if loadKeys {
		keyFunc := t.AllApplicationKeys
		if includeKBFSKeys {
			keyFunc = t.AllApplicationKeysWithKBFS
		}
		applicationKeys, err = keyFunc(ctx, application)
		if err != nil {
			return ret, err
		}
	}

	members, err := t.Members()
	if err != nil {
		return ret, err
	}

	var writers, onlyReaders, onlyRestrictedBots []keybase1.UserVersion

	writers = append(writers, members.Writers...)
	writers = append(writers, members.Admins...)
	writers = append(writers, members.Owners...)
	onlyReaders = append(onlyReaders, members.Readers...)
	onlyReaders = append(onlyReaders, members.Bots...)
	onlyRestrictedBots = append(onlyRestrictedBots, members.RestrictedBots...)

	ret = keybase1.TeamPlusApplicationKeys{
		Id:                 t.chain().GetID(),
		Name:               t.Name().String(),
		Implicit:           t.IsImplicit(),
		Public:             t.IsPublic(),
		Application:        application,
		Writers:            writers,
		OnlyReaders:        onlyReaders,
		OnlyRestrictedBots: onlyRestrictedBots,
		ApplicationKeys:    applicationKeys,
	}

	return ret, nil
}
