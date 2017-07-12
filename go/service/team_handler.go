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

func newTeamHandler(g *libkb.GlobalContext) *teamHandler {
	return &teamHandler{
		Contextified: libkb.NewContextified(g),
	}
}

func (r *teamHandler) Create(ctx context.Context, cli gregor1.IncomingInterface, category string, item gregor.Item) (bool, error) {
	switch category {
	case "team.clkr":
		return true, r.rotateTeam(ctx, item)
	case "team.sbs":
		return true, r.sharingBeforeSignup(ctx, item)
	case "team.change":
		return true, r.changeTeam(ctx, item, keybase1.TeamChangeSet{})
	case "team.rename":
		return true, r.changeTeam(ctx, item, keybase1.TeamChangeSet{Renamed: true})
	default:
		return false, fmt.Errorf("unknown teamHandler category: %q", category)
	}
}

func (r *teamHandler) rotateTeam(ctx context.Context, item gregor.Item) error {
	r.G().Log.Debug("team.clkr received")
	var msg keybase1.TeamCLKRMsg
	if err := json.Unmarshal(item.Body().Bytes(), &msg); err != nil {
		r.G().Log.Debug("error unmarshaling team.clkr item: %s", err)
		return err
	}
	r.G().Log.Debug("team.clkr unmarshaled: %+v", msg)

	return teams.HandleRotateRequest(ctx, r.G(), msg.TeamID, keybase1.PerTeamKeyGeneration(msg.Generation))
}

func (r *teamHandler) changeTeam(ctx context.Context, item gregor.Item, changes keybase1.TeamChangeSet) error {
	var rows []keybase1.TeamChangeRow
	if err := json.Unmarshal(item.Body().Bytes(), &rows); err != nil {
		r.G().Log.Debug("error unmarshaling team.(change|rename) item: %s", err)
		return err
	}
	r.G().Log.Debug("team.(change|rename) unmarshaled: %+v", rows)
	return teams.HandleChangeNotification(ctx, r.G(), rows, changes)
}

func (r *teamHandler) sharingBeforeSignup(ctx context.Context, item gregor.Item) error {
	r.G().Log.Debug("team.sbs received")
	var msg keybase1.TeamSBSMsg
	if err := json.Unmarshal(item.Body().Bytes(), &msg); err != nil {
		r.G().Log.Debug("error unmarshaling team.sbs item: %s", err)
		return err
	}
	r.G().Log.Debug("team.sbs unmarshaled: %+v", msg)

	return teams.HandleSBSRequest(ctx, r.G(), msg)
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
