// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// Handlers for team-related gregor messages

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
	case "team.seitan":
		return true, r.seitanCompletion(ctx, cli, item)
	case "team.member_out_from_reset":
		return true, r.memberOutFromReset(ctx, cli, item)
	case "team.abandoned":
		return true, r.abandonTeam(ctx, cli, item)
	default:
		return false, fmt.Errorf("unknown teamHandler category: %q", category)
	}
}

func (r *teamHandler) rotateTeam(ctx context.Context, cli gregor1.IncomingInterface, item gregor.Item) error {
	r.G().Log.CDebugf(ctx, "teamHandler: team.clkr received")
	var msg keybase1.TeamCLKRMsg
	if err := json.Unmarshal(item.Body().Bytes(), &msg); err != nil {
		r.G().Log.CDebugf(ctx, "error unmarshaling team.clkr item: %s", err)
		return err
	}
	r.G().Log.CDebugf(ctx, "team.clkr unmarshaled: %+v", msg)

	if err := teams.HandleRotateRequest(ctx, r.G(), msg.TeamID, keybase1.PerTeamKeyGeneration(msg.Generation)); err != nil {
		return err
	}

	r.G().Log.CDebugf(ctx, "dismissing team.clkr item since rotate succeeded")
	return r.G().GregorDismisser.DismissItem(ctx, cli, item.Metadata().MsgID())
}

func (r *teamHandler) memberOutFromReset(ctx context.Context, cli gregor1.IncomingInterface, item gregor.Item) error {
	nm := "team.member_out_from_reset"
	r.G().Log.CDebugf(ctx, "teamHandler: %s received", nm)
	var msg keybase1.TeamMemberOutFromReset
	if err := json.Unmarshal(item.Body().Bytes(), &msg); err != nil {
		r.G().Log.CDebugf(ctx, "error unmarshaling %s item: %s", nm, err)
		return err
	}
	r.G().Log.CDebugf(ctx, "%s unmarshaled: %+v", nm, msg)

	if err := r.G().UIDMapper.ClearUIDAtEldestSeqno(ctx, r.G(), msg.ResetUser.Uid, msg.ResetUser.EldestSeqno); err != nil {
		return err
	}

	r.G().Log.CDebugf(ctx, "%s: cleared UIDMap cache for %s%%%d", nm, msg.ResetUser.Uid, msg.ResetUser.EldestSeqno)
	return nil
}

type abandonMsg struct {
	TeamID keybase1.TeamID `json:"team_id"`
}

func (r *teamHandler) abandonTeam(ctx context.Context, cli gregor1.IncomingInterface, item gregor.Item) error {
	nm := "team.abandoned"
	r.G().Log.CDebugf(ctx, "teamHandler: %s received", nm)
	var msg abandonMsg
	if err := json.Unmarshal(item.Body().Bytes(), &msg); err != nil {
		r.G().Log.CDebugf(ctx, "error unmarshaling %s item: %s", nm, err)
		return err
	}
	r.G().Log.CDebugf(ctx, "%s unmarshaled: %+v", nm, msg)

	r.G().NotifyRouter.HandleTeamAbandoned(ctx, msg.TeamID)

	r.G().Log.CDebugf(ctx, "dismissing %s", nm)
	return r.G().GregorDismisser.DismissItem(ctx, cli, item.Metadata().MsgID())
}

func (r *teamHandler) changeTeam(ctx context.Context, cli gregor1.IncomingInterface, item gregor.Item, changes keybase1.TeamChangeSet) error {
	var rows []keybase1.TeamChangeRow
	r.G().Log.CDebugf(ctx, "teamHandler: changeTeam received")
	if err := json.Unmarshal(item.Body().Bytes(), &rows); err != nil {
		r.G().Log.CDebugf(ctx, "error unmarshaling team.(change|rename) item: %s", err)
		return err
	}
	r.G().Log.CDebugf(ctx, "team.(change|rename) unmarshaled: %+v", rows)
	if err := teams.HandleChangeNotification(ctx, r.G(), rows, changes); err != nil {
		return err
	}

	// Locally dismiss this now that we have processed it so we can avoid replaying it over and over
	if err := r.G().GregorDismisser.LocalDismissItem(ctx, item.Metadata().MsgID()); err != nil {
		r.G().Log.CDebugf(ctx, "failed to local dismiss team change: %s", err)
	}
	return nil
}

func (r *teamHandler) deleteTeam(ctx context.Context, cli gregor1.IncomingInterface, item gregor.Item) error {
	var rows []keybase1.TeamChangeRow
	if err := json.Unmarshal(item.Body().Bytes(), &rows); err != nil {
		r.G().Log.CDebugf(ctx, "error unmarshaling team.(change|rename) item: %s", err)
		return err
	}
	r.G().Log.CDebugf(ctx, "teamHandler: team.delete unmarshaled: %+v", rows)

	err := teams.HandleDeleteNotification(ctx, r.G(), rows)
	if err != nil {
		return err
	}

	return r.G().GregorDismisser.DismissItem(ctx, cli, item.Metadata().MsgID())
}

func (r *teamHandler) exitTeam(ctx context.Context, cli gregor1.IncomingInterface, item gregor.Item) error {
	var rows []keybase1.TeamExitRow
	if err := json.Unmarshal(item.Body().Bytes(), &rows); err != nil {
		r.G().Log.CDebugf(ctx, "error unmarshaling team.exit item: %s", err)
		return err
	}
	r.G().Log.CDebugf(ctx, "teamHandler: team.exit unmarshaled: %+v", rows)
	err := teams.HandleExitNotification(ctx, r.G(), rows)
	if err != nil {
		return err
	}

	r.G().Log.Debug("dismissing team.exit: %v", item.Metadata().MsgID().String())
	return r.G().GregorDismisser.DismissItem(ctx, cli, item.Metadata().MsgID())
}

func (r *teamHandler) sharingBeforeSignup(ctx context.Context, cli gregor1.IncomingInterface, item gregor.Item) error {
	r.G().Log.CDebugf(ctx, "teamHandler: team.sbs received")
	var msg keybase1.TeamSBSMsg
	if err := json.Unmarshal(item.Body().Bytes(), &msg); err != nil {
		r.G().Log.CDebugf(ctx, "error unmarshaling team.sbs item: %s", err)
		return err
	}
	r.G().Log.CDebugf(ctx, "team.sbs unmarshaled: %+v", msg)

	if err := teams.HandleSBSRequest(ctx, r.G(), msg); err != nil {
		return err
	}

	r.G().Log.Debug("dismissing team.sbs item since it succeeded")
	return r.G().GregorDismisser.DismissItem(ctx, cli, item.Metadata().MsgID())
}

func (r *teamHandler) openTeamAccessRequest(ctx context.Context, cli gregor1.IncomingInterface, item gregor.Item) error {
	r.G().Log.CDebugf(ctx, "teamHandler: team.openreq received")
	var msg keybase1.TeamOpenReqMsg
	if err := json.Unmarshal(item.Body().Bytes(), &msg); err != nil {
		r.G().Log.CDebugf(ctx, "error unmarshaling team.openreq item: %s", err)
		return err
	}
	r.G().Log.CDebugf(ctx, "team.openreq unmarshaled: %+v", msg)

	if err := teams.HandleOpenTeamAccessRequest(ctx, r.G(), msg); err != nil {
		return err
	}

	r.G().Log.CDebugf(ctx, "dismissing team.openreq item since it succeeded")
	return r.G().GregorDismisser.DismissItem(ctx, cli, item.Metadata().MsgID())
}

func (r *teamHandler) seitanCompletion(ctx context.Context, cli gregor1.IncomingInterface, item gregor.Item) error {
	r.G().Log.CDebugf(ctx, "teamHandler: team.seitan received")
	var msg keybase1.TeamSeitanMsg
	if err := json.Unmarshal(item.Body().Bytes(), &msg); err != nil {
		r.G().Log.CDebugf(ctx, "error unmarshaling team.seitan item: %s", err)
		return err
	}
	r.G().Log.CDebugf(ctx, "team.seitan unmarshaled: %+v", msg)

	if err := teams.HandleTeamSeitan(ctx, r.G(), msg); err != nil {
		return err
	}

	r.G().Log.CDebugf(ctx, "dismissing team.seitan item since it succeeded")
	return r.G().GregorDismisser.DismissItem(ctx, cli, item.Metadata().MsgID())
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
