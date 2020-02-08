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

type teamMap map[keybase1.TeamID]keybase1.TeamSearchItem

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
	keybase1.TeamSearchExport
	Status libkb.AppStatus
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

type storageItem struct {
	Items     teamMap
	Suggested []keybase1.TeamID
	Hash      string
}

func dbKey() libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBOpenTeams,
		Key: "v4",
	}
}

func getOpenTeams(mctx libkb.MetaContext) (res storageItem, err error) {
	get := func() (res storageItem, err error) {
		found, err := mctx.G().GetKVStore().GetInto(&res, dbKey())
		if err != nil {
			return res, err
		}
		if !found {
			return res, errors.New("no open teams found")
		}
		return res, nil
	}
	if res, err = get(); err != nil {
		mctx.Debug("OpenSearch.getOpenTeams: failed to get open teams, refreshing")
		refreshOpenTeams(mctx, "")
		return get()
	}
	return res, nil
}

func refreshOpenTeams(mctx libkb.MetaContext, hash string) {
	saved := true
	tracer := mctx.G().CTimeTracer(mctx.Ctx(), "OpenSearch.refreshOpenTeams", true)
	defer tracer.Finish()
	defer func() {
		if saved {
			lastRefresh = time.Now()
		}
	}()
	mctx.Debug("OpenSearch.refreshOpenTeams: using hash: %s", hash)
	a := libkb.NewAPIArg("teamsearch/refresh")
	a.Args = libkb.HTTPArgs{}
	a.Args["hash"] = libkb.S{Val: hash}
	a.SessionType = libkb.APISessionTypeREQUIRED
	var apiRes teamRefreshResult
	if err := mctx.G().API.GetDecode(mctx, a, &apiRes); err != nil {
		mctx.Debug("OpenSearch.refreshOpenTeams: failed to fetch open teams: %s", err)
		saved = false
		return
	}
	if len(apiRes.Items) == 0 {
		mctx.Debug("OpenSearch.refreshOpenTeams: hash match, standing pat")
		return
	}
	mctx.Debug("OpenSearch.refreshOpenTeams: received %d teams, suggested: %d", len(apiRes.Items),
		len(apiRes.Suggested))
	var out storageItem
	out.Items = apiRes.Items
	out.Suggested = apiRes.Suggested
	out.Hash = apiRes.Hash()
	if err := mctx.G().GetKVStore().PutObj(dbKey(), nil, out); err != nil {
		mctx.Debug("OpenSearch.refreshOpenTeams: failed to put: %s", err)
		saved = false
		return
	}
}

// Local performs a local search for Keybase open teams.
func Local(mctx libkb.MetaContext, query string, limit int) (res []keybase1.TeamSearchItem, err error) {
	var si storageItem
	mctx = mctx.WithLogTag("OTS")
	tracer := mctx.G().CTimeTracer(mctx.Ctx(), "OpenSearch.Local", true)
	defer tracer.Finish()
	defer func() {
		// spawn a refresh if enough time has passed since our last search
		if time.Since(lastRefresh) > refreshThreshold {
			go refreshOpenTeams(mctx, si.Hash)
		}
	}()
	if si, err = getOpenTeams(mctx); err != nil {
		return res, err
	}
	query = strings.ToLower(query)
	var results []*rankedSearchItem
	if len(query) == 0 {
		for index, id := range si.Suggested {
			results = append(results, &rankedSearchItem{
				item:  si.Items[id],
				score: 100.0 + float64((len(si.Suggested) - index)),
			})
		}
	} else {
		for _, item := range si.Items {
			score := scoreItemFromQuery(query, item)
			if filterScore(score) {
				continue
			}
			results = append(results, &rankedSearchItem{
				item:  item,
				score: score,
			})
		}
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
