// Copyright 2020 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package teams

import (
	"context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type teamSearchResult struct {
	Results []keybase1.TeamSearchItem `json:"results"`
	Status  libkb.AppStatus
}

func (r *teamSearchResult) GetAppStatus() *libkb.AppStatus {
	return &r.Status
}

// Search performs a server-based search for Keybase open teams.
func Search(
	ctx context.Context, g *libkb.GlobalContext, query string, limit int) (
	[]keybase1.TeamSearchItem, error) {
	tracer := g.CTimeTracer(ctx, "Teams.Search", true)
	defer tracer.Finish()

	a := libkb.NewAPIArg("teamsearch/search")
	a.Args = libkb.HTTPArgs{}
	a.Args["query"] = libkb.S{Val: query}
	a.Args["limit"] = libkb.I{Val: limit}

	mctx := libkb.NewMetaContext(ctx, g)
	a.SessionType = libkb.APISessionTypeREQUIRED
	var res teamSearchResult
	if err := mctx.G().API.GetDecode(mctx, a, &res); err != nil {
		return nil, err
	}
	return res.Results, nil
}
