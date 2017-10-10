// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"encoding/json"
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
)

const teamHandlerName = "teamHandler"

type teamHandler struct {
	libkb.Contextified
}

var _ libkb.GregorInBandMessageHandler = (*teamHandler)(nil)

func newTeamHandler(g *libkb.GlobalContext) *teamHandler {
	return &teamHandler{
		Contextified: libkb.NewContextified(g),
	}
}

func (r *teamHandler) Create(ctx context.Context, cli gregor1.IncomingInterface, category string, item gregor.Item) (bool, error) {
	switch category {
	case "team.clkr":
		return true, r.rotateTeam(ctx, cli, item)
	case "team.sbs":
		return true, r.sharingBeforeSignup(ctx, cli, item)
	case "team.openreq":
		return true, r.openTeamAccessRequest(ctx, cli, item)
	case "team.change":
		return true, r.changeTeam(ctx, cli, item, keybase1.TeamChangeSet{})
	case "team.rename":
		return true, r.changeTeam(ctx, cli, item, keybase1.TeamChangeSet{Renamed: true})
	case "team.delete":
		return true, r.deleteTeam(ctx, cli, item)
	case "team.exit":
		return true, r.exitTeam(ctx, cli, item)
	default:
		return false, fmt.Errorf("unknown teamHandler category: %q", category)
	}
}

func (r *teamHandler) rotateTeam(ctx context.Context, cli gregor1.IncomingInterface, item gregor.Item) error {
	r.G().Log.Debug("team.clkr received")
	var msg keybase1.TeamCLKRMsg
	if err := json.Unmarshal(item.Body().Bytes(), &msg); err != nil {
		r.G().Log.Debug("error unmarshaling team.clkr item: %s", err)
		return err
	}
	r.G().Log.Debug("team.clkr unmarshaled: %+v", msg)

	// CORE-6322 find out whether this is for a public team
	public := false
	if err := teams.HandleRotateRequest(ctx, r.G(), msg.TeamID, public, keybase1.PerTeamKeyGeneration(msg.Generation)); err != nil {
		return err
	}

	r.G().Log.Debug("dismissing team.clkr item since rotate succeeded")
	return r.G().GregorDismisser.DismissItem(cli, item.Metadata().MsgID())
}

func (r *teamHandler) changeTeam(ctx context.Context, cli gregor1.IncomingInterface, item gregor.Item, changes keybase1.TeamChangeSet) error {
	var rows []keybase1.TeamChangeRow
	if err := json.Unmarshal(item.Body().Bytes(), &rows); err != nil {
		r.G().Log.Debug("error unmarshaling team.(change|rename) item: %s", err)
		return err
	}
	r.G().Log.Debug("team.(change|rename) unmarshaled: %+v", rows)

	return teams.HandleChangeNotification(ctx, r.G(), rows, changes)
}

func (r *teamHandler) deleteTeam(ctx context.Context, cli gregor1.IncomingInterface, item gregor.Item) error {
	var rows []keybase1.TeamChangeRow
	if err := json.Unmarshal(item.Body().Bytes(), &rows); err != nil {
		r.G().Log.Debug("error unmarshaling team.(change|rename) item: %s", err)
		return err
	}
	r.G().Log.Debug("team.delete unmarshaled: %+v", rows)

	err := teams.HandleDeleteNotification(ctx, r.G(), rows)
	if err != nil {
		return err
	}

	return r.G().GregorDismisser.DismissItem(cli, item.Metadata().MsgID())
}

func (r *teamHandler) exitTeam(ctx context.Context, cli gregor1.IncomingInterface, item gregor.Item) error {
	var rows []keybase1.TeamExitRow
	if err := json.Unmarshal(item.Body().Bytes(), &rows); err != nil {
		r.G().Log.Debug("error unmarshaling team.exit item: %s", err)
		return err
	}
	r.G().Log.Debug("team.exit unmarshaled: %+v", rows)
	err := teams.HandleExitNotification(ctx, r.G(), rows)
	if err != nil {
		return err
	}

	r.G().Log.Debug("dismissing team.exit: %v", item.Metadata().MsgID().String())
	return r.G().GregorDismisser.DismissItem(cli, item.Metadata().MsgID())
}

func (r *teamHandler) sharingBeforeSignup(ctx context.Context, cli gregor1.IncomingInterface, item gregor.Item) error {
	r.G().Log.Debug("team.sbs received")
	var msg keybase1.TeamSBSMsg
	if err := json.Unmarshal(item.Body().Bytes(), &msg); err != nil {
		r.G().Log.Debug("error unmarshaling team.sbs item: %s", err)
		return err
	}
	r.G().Log.Debug("team.sbs unmarshaled: %+v", msg)

	if err := teams.HandleSBSRequest(ctx, r.G(), msg); err != nil {
		return err
	}

	r.G().Log.Debug("dismissing team.sbs item since it succeeded")
	return r.G().GregorDismisser.DismissItem(cli, item.Metadata().MsgID())
}

func (r *teamHandler) openTeamAccessRequest(ctx context.Context, cli gregor1.IncomingInterface, item gregor.Item) error {
	r.G().Log.Debug("team.openreq received")
	var msg keybase1.TeamOpenReqMsg
	if err := json.Unmarshal(item.Body().Bytes(), &msg); err != nil {
		r.G().Log.Debug("error unmarshaling team.openreq item: %s", err)
		return err
	}
	r.G().Log.Debug("team.openreq unmarshaled: %+v", msg)

	if err := teams.HandleOpenTeamAccessRequest(ctx, r.G(), msg); err != nil {
		return err
	}

	r.G().Log.Debug("dismissing team.openreq item since it succeeded")
	return r.G().GregorDismisser.DismissItem(cli, item.Metadata().MsgID())
}

func (r *teamHandler) Dismiss(ctx context.Context, cli gregor1.IncomingInterface, category string, item gregor.Item) (bool, error) {
	return false, nil
}

func (r *teamHandler) IsAlive() bool {
	return true
}

func (r *teamHandler) Name() string {
	return teamHandlerName
}
