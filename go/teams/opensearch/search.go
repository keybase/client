// Copyright 2020 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package opensearch

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

const refreshThreshold = time.Hour

var lastRefresh time.Time

type teamSearchResult struct {
	Results []keybase1.TeamSearchItem `json:"results"`
	Status  libkb.AppStatus
}

func (r *teamSearchResult) GetAppStatus() *libkb.AppStatus {
	return &r.Status
}

type teamRefreshResult struct {
	Results []keybase1.TeamSearchItem `json:"results"`
	Status  libkb.AppStatus
}

func (r *teamRefreshResult) GetAppStatus() *libkb.AppStatus {
	return &r.Status
}

type rankedSearchItem struct {
	item  keybase1.TeamSearchItem
	score float64
}

func (i rankedSearchItem) String() string {
	description := ""
	if i.item.Description != nil {
		description = *i.item.Description
	}
	return fmt.Sprintf(
		"Name: %s Description: %s MemberCount: %d LastActive: %v Score: %.2f isDemoted: %v",
		i.item.Name, description, i.item.MemberCount,
		i.item.LastActive.Time(), i.score, i.item.IsDemoted)
}

func getOpenTeams(mctx libkb.MetaContext) (res []keybase1.TeamSearchItem, err error) {
	found, err := mctx.G().GetKVStore().GetInto(&res, libkb.DbKey{Typ: libkb.DBOpenTeams})
	if err != nil {
		return res, err
	}
	if !found {
		return res, errors.New("no open teams found")
	}
	return res, nil
}

func refreshOpenTeams(mctx libkb.MetaContext) {
	a := libkb.NewAPIArg("teamsearch/refresh")
	a.Args = libkb.HTTPArgs{}
	a.SessionType = libkb.APISessionTypeNONE
	var apiRes teamRefreshResult
	if err := mctx.G().API.GetDecode(mctx, a, &apiRes); err != nil {
		mctx.Debug("refreshOpenTeams: failed to fetch open teams: %s", err)
		return
	}
	if err := mctx.G().GetKVStore().PutObj(libkb.DbKey{Typ: libkb.DBOpenTeams}, nil, apiRes.Results); err != nil {
		mctx.Debug("refreshOpenTeams: failed to put: %s", err)
	}
}

// Local performs a local search for Keybase open teams.
func Local(mctx libkb.MetaContext, query string, limit int) (res []keybase1.TeamSearchItem, err error) {
	tracer := mctx.G().CTimeTracer(mctx.Ctx(), "OpenSearch.Local", true)
	defer tracer.Finish()
	defer func() {
		// spawn a refresh if enough time has passed since our last search
		if time.Since(lastRefresh) > refreshThreshold {
			go refreshOpenTeams(mctx)
		}
	}()
	teams, err := getOpenTeams(mctx)
	if err != nil {
		return res, err
	}
	query = strings.ToLower(query)
	var results []*rankedSearchItem
	for _, item := range teams {
		score := scoreItemFromQuery(query, item)
		if filterScore(score) {
			continue
		}
		results = append(results, &rankedSearchItem{
			item:  item,
			score: score,
		})
	}
	sort.Slice(results, func(i, j int) bool {
		return results[i].score > results[j].score
	})
	for index, r := range results {
		if index >= limit {
			break
		}
		res = append(res, r.item)
	}
	return res, nil
}

func Remote(mctx libkb.MetaContext, query string, limit int) ([]keybase1.TeamSearchItem, error) {
	tracer := mctx.G().CTimeTracer(mctx.Ctx(), "OpenSearch.Remote", true)
	defer tracer.Finish()

	a := libkb.NewAPIArg("teamsearch/search")
	a.Args = libkb.HTTPArgs{}
	a.Args["query"] = libkb.S{Val: query}
	a.Args["limit"] = libkb.I{Val: limit}

	a.SessionType = libkb.APISessionTypeREQUIRED
	var res teamSearchResult
	if err := mctx.G().API.GetDecode(mctx, a, &res); err != nil {
		return nil, err
	}
	return res.Results, nil
}
