// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.
// +build ignore

package engine

import (
	"encoding/json"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/team"
)

// TeamGet is an engine.
type TeamGet struct {
	libkb.Contextified
	ctx   *Context
	arg   keybase1.TeamGetArg
	state team.TeamSigChainState
}

// NewTeamGet creates a TeamGet engine.
func NewTeamGet(g *libkb.GlobalContext, arg keybase1.TeamGetArg) *TeamGet {
	return &TeamGet{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
	}
}

// Name is the unique engine name.
func (e *TeamGet) Name() string {
	return "TeamGet"
}

// GetPrereqs returns the engine prereqs.
func (e *TeamGet) Prereqs() Prereqs {
	return Prereqs{
		Session: true,
		Device:  true,
	}
}

// RequiredUIs returns the required UIs.
func (e *TeamGet) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *TeamGet) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *TeamGet) Run(ctx *Context) error {
	e.ctx = ctx

	links, err := e.teamChainLinks()
	if err != nil {
		return err
	}

	player, err := e.newPlayer(links)
	if err != nil {
		return err
	}

	e.state, err = player.GetState()
	if err != nil {
		return err
	}

	return nil
}

func (e *TeamGet) ChainState() team.TeamSigChainState {
	return e.state
}

func (e *TeamGet) teamChainLinks() ([]team.SCChainLink, error) {
	arg := libkb.NewRetryAPIArg("team/get")
	arg.SessionType = libkb.APISessionTypeREQUIRED
	arg.Args = libkb.HTTPArgs{
		"name": libkb.S{Val: e.arg.Name},
	}
	var chain rawChain
	if err := e.G().API.GetDecode(arg, &chain); err != nil {
		return nil, err
	}
	var links []team.SCChainLink
	for _, raw := range chain.Chain {
		link, err := team.ParseTeamChainLink(string(raw))
		if err != nil {
			return nil, err
		}
		links = append(links, link)
	}
	return links, nil
}

func (e *TeamGet) newPlayer(links []team.SCChainLink) (*team.TeamSigChainPlayer, error) {
	player := team.NewTeamSigChainPlayer(e, team.NewUserVersion(e.G().Env.GetUsername().String(), 1), false)
	if err := player.AddChainLinks(links); err != nil {
		return nil, err
	}
	return player, nil
}

func (e *TeamGet) UsernameForUID(uid keybase1.UID) (string, error) {
	name, err := e.G().GetUPAKLoader().LookupUsername(e.ctx.NetContext, uid)
	if err != nil {
		return "", err
	}
	return name.String(), nil
}

type rawChain struct {
	Status libkb.AppStatus
	Chain  []json.RawMessage
}

func (r *rawChain) GetAppStatus() *libkb.AppStatus {
	return &r.Status
}
