// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package git

import (
	"errors"
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
)

type TeamerImpl struct {
	libkb.Contextified
}

func NewTeamer(g *libkb.GlobalContext) Teamer {
	return &TeamerImpl{
		Contextified: libkb.NewContextified(g),
	}
}

func (t *TeamerImpl) LookupOrCreate(ctx context.Context, folder keybase1.FolderHandle) (res keybase1.TeamIDWithVisibility, err error) {
	defer t.G().CTrace(ctx, fmt.Sprintf("git.Teamer#LookupOrCreate(%s, ftyp:%v)", folder.Name, folder.FolderType), func() error { return err })()

	switch folder.FolderType {
	case keybase1.FolderType_PRIVATE:
		return t.lookupOrCreateImplicitTeam(ctx, folder)
	case keybase1.FolderType_PUBLIC:
		return t.lookupOrCreateImplicitTeam(ctx, folder)
	case keybase1.FolderType_TEAM:
		return t.lookupTeam(ctx, folder)
	default:
		return res, fmt.Errorf("unrecognized folder type: %v", folder.FolderType)
	}
}

func (t *TeamerImpl) lookupTeam(ctx context.Context, folder keybase1.FolderHandle) (res keybase1.TeamIDWithVisibility, err error) {
	if folder.FolderType == keybase1.FolderType_PUBLIC {
		return res, fmt.Errorf("public team git repos not supported")
	}
	if err != nil {
		return res, err
	}
	team, err := teams.Load(ctx, t.G(), keybase1.LoadTeamArg{
		Name:        folder.Name,
		Public:      folder.FolderType == keybase1.FolderType_PUBLIC,
		ForceRepoll: false, // if subteams get renamed in a racy way, just let this fail
	})
	if err != nil {
		return res, err
	}
	if (folder.FolderType == keybase1.FolderType_PUBLIC) != team.IsPublic() {
		return res, fmt.Errorf("team publicity mismatch folder:%v != team:%v", folder.FolderType, team.IsPublic())
	}
	visibility := keybase1.TLFVisibility_PRIVATE
	if folder.FolderType == keybase1.FolderType_PUBLIC {
		visibility = keybase1.TLFVisibility_PUBLIC
	}
	return keybase1.TeamIDWithVisibility{
		TeamID:     team.ID,
		Visibility: visibility,
	}, nil
}

func (t *TeamerImpl) lookupOrCreateImplicitTeam(ctx context.Context, folder keybase1.FolderHandle) (res keybase1.TeamIDWithVisibility, err error) {
	visibility := keybase1.TLFVisibility_PRIVATE
	if folder.FolderType == keybase1.FolderType_PUBLIC {
		visibility = keybase1.TLFVisibility_PUBLIC
	} else if folder.FolderType != keybase1.FolderType_PRIVATE {
		return res, errors.New("bad folder")
	}

	impName, err := libkb.ParseImplicitTeamTLFName(t.G().MakeAssertionContext(t.MetaContext(ctx)), "/keybase/"+folder.ToString())
	if err != nil {
		return res, err
	}
	lookupName, err := teams.FormatImplicitTeamDisplayName(ctx, t.G(), impName)
	if err != nil {
		return res, err
	}

	isPublic := folder.FolderType == keybase1.FolderType_PUBLIC

	team, _, _, err := teams.LookupOrCreateImplicitTeam(ctx, t.G(), lookupName, isPublic)
	if err != nil {
		return res, err
	}
	return keybase1.TeamIDWithVisibility{
		TeamID:     team.ID,
		Visibility: visibility,
	}, nil
}
