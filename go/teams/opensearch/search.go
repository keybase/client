// Copyright 2020 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package opensearch

import (
	"errors"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
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

type storageItem struct {
	Items     teamMap
	Suggested []keybase1.TeamID
	Hash      string
}

func dbKey() libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBOpenTeams,
		Key: "v0",
	}
}

func getCurrentHash(mctx libkb.MetaContext) (hash string) {
	var si storageItem
	found, err := mctx.G().GetKVStore().GetInto(&si, dbKey())
	if err != nil {
		mctx.Debug("OpenSearch.getCurrentHash: failed to read: %s", err)
		return ""
	}
	if !found {
		return ""
	}
	return si.Hash
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
		refreshOpenTeams(mctx, true)
		return get()
	}
	return res, nil
}

var refreshMu sync.Mutex

func refreshOpenTeams(mctx libkb.MetaContext, force bool) {
	tracer := mctx.G().CTimeTracer(mctx.Ctx(), "OpenSearch.refreshOpenTeams", true)
	defer tracer.Finish()
	refreshMu.Lock()
	defer refreshMu.Unlock()
	if !force && time.Since(lastRefresh) < refreshThreshold {
		return
	}
	saved := true
	defer func() {
		if saved {
			lastRefresh = time.Now()
		}
	}()
	hash := getCurrentHash(mctx)
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
		go refreshOpenTeams(mctx, false)
	}()
	if si, err = getOpenTeams(mctx); err != nil {
		return res, err
	}
	query = strings.ToLower(query)
	var results []rankedSearchItem
	if len(query) == 0 {
		for index, id := range si.Suggested {
			results = append(results, rankedSearchItem{
				item:  si.Items[id],
				score: 100.0 + float64((len(si.Suggested) - index)),
			})
		}
	} else {
		for _, item := range si.Items {
			rankedItem := rankedSearchItem{
				item: item,
			}
			rankedItem.score = rankedItem.Score(query)
			if FilterScore(rankedItem.score) {
				continue
			}
			results = append(results, rankedItem)
		}
	}
	sort.Slice(results, func(i, j int) bool {
		return results[i].score > results[j].score
	})
	for index, r := range results {
		if index >= limit {
			break
		}
		if r.item.InTeam, err = mctx.G().ChatHelper.InTeam(mctx.Ctx(),
			gregor1.UID(mctx.G().GetMyUID().ToBytes()), r.item.Id); err != nil {
			mctx.Debug("OpenSearch.Local: failed to get inTeam for: %s err: %s", r.item.Id, err)
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
