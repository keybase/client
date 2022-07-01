// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"
	"fmt"
	"regexp"
	"sort"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

type ListTrackingEngineArg struct {
	Assertion  string
	UID        keybase1.UID
	CachedOnly bool

	// If CachedOnly is set and StalenessWindow is non-nil, will load with
	// StaleOK and use the relaxed CachedOnlyStalenessWindow instead.
	CachedOnlyStalenessWindow *time.Duration

	JSON    bool
	Verbose bool
	Filter  string
}

// ListTrackingEngine loads the follows of the given user using their sigchain,
// but relies on the server to filter out users who have reset after the follow
// statement.
type ListTrackingEngine struct {
	arg         *ListTrackingEngineArg
	tableResult keybase1.UserSummarySet
	jsonResult  string
	libkb.Contextified

	disableTrackerSyncerForTest bool
}

func NewListTrackingEngine(g *libkb.GlobalContext, arg *ListTrackingEngineArg) *ListTrackingEngine {
	return &ListTrackingEngine{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

func (e *ListTrackingEngine) Name() string {
	return "ListTracking"
}

func (e *ListTrackingEngine) Prereqs() Prereqs { return Prereqs{} }

func (e *ListTrackingEngine) RequiredUIs() []libkb.UIKind { return []libkb.UIKind{} }

func (e *ListTrackingEngine) SubConsumers() []libkb.UIConsumer { return nil }

func (e *ListTrackingEngine) Run(m libkb.MetaContext) (err error) {
	uid, err := lookupUID(m, e.arg.UID, e.arg.Assertion, e.arg.CachedOnly)
	if err != nil {
		return err
	}

	// Get version according to server so we can filter out reset users later
	ts := libkb.NewServertrustTrackerSyncer(m.G(), m.G().GetMyUID(), libkb.FollowDirectionFollowing)
	var tsErr error
	if e.disableTrackerSyncerForTest {
		tsErr = errors.New("tracker syncer disabled for test")
	} else if e.arg.CachedOnly {
		tsErr = libkb.RunSyncerCached(m, ts, uid)
	} else {
		tsErr = libkb.RunSyncer(m, ts, uid, false /* loggedIn */, false /* forceReload */)
	}
	useServerLookup := false
	serverLookup := make(map[keybase1.UID]struct{})
	fullNames := make(map[keybase1.UID]string)
	if tsErr != nil {
		m.Warning("failed to load following list from server (cachedOnly=%t); continuing: %s", e.arg.CachedOnly, tsErr)
	} else {
		useServerLookup = true
		m.Debug("got following list from server (len=%d, cachedOnly=%t); using it to filter sigchain list", len(ts.Result().Users), e.arg.CachedOnly)
		for _, user := range ts.Result().Users {
			serverLookup[user.Uid] = struct{}{}
			fullNames[user.Uid] = user.FullName
		}
	}

	// Load unstubbed so we get track links
	larg := libkb.NewLoadUserArgWithMetaContext(m).
		WithUID(uid).
		WithStubMode(libkb.StubModeUnstubbed).
		WithCachedOnly(e.arg.CachedOnly).
		WithSelf(uid.Exists() && uid.Equal(m.G().GetMyUID()))
	if e.arg.CachedOnly && e.arg.CachedOnlyStalenessWindow != nil {
		larg = larg.WithStaleOK(true)
	}
	upak, _, err := m.G().GetUPAKLoader().LoadV2(larg)
	if err != nil {
		return err
	}
	if upak == nil {
		return libkb.UserNotFoundError{}
	}

	if e.arg.CachedOnly && e.arg.CachedOnlyStalenessWindow != nil {
		if m.G().Clock().Since(keybase1.FromTime(upak.Uvv.CachedAt)) > *e.arg.CachedOnlyStalenessWindow {
			msg := fmt.Sprintf("upak was cached but exceeded custom staleness window %v", *e.arg.CachedOnlyStalenessWindow)
			return libkb.UserNotFoundError{UID: uid, Msg: msg}
		}
	}

	unfilteredTracks := upak.Current.RemoteTracks

	var rxx *regexp.Regexp
	if e.arg.Filter != "" {
		rxx, err = regexp.Compile(e.arg.Filter)
		if err != nil {
			return err
		}
	}

	// Filter out any marked reset by server, or due to Filter argument
	var filteredTracks []keybase1.RemoteTrack
	for _, track := range unfilteredTracks {
		trackedUID := track.Uid
		if useServerLookup {
			if _, ok := serverLookup[trackedUID]; !ok {
				m.Debug("filtering out uid %s in sigchain list but not provided by server", trackedUID)
				continue
			}
		}
		if rxx != nil && !rxx.MatchString(track.Username) {
			continue
		}
		filteredTracks = append(filteredTracks, track)
	}

	sort.Slice(filteredTracks, func(i, j int) bool {
		return filteredTracks[i].Username < filteredTracks[j].Username
	})

	if e.arg.JSON {
		return e.runJSON(m, filteredTracks, e.arg.Verbose)
	}
	return e.runTable(m, filteredTracks, fullNames)
}

func (e *ListTrackingEngine) runTable(m libkb.MetaContext, filteredTracks []keybase1.RemoteTrack, fullNames map[keybase1.UID]string) error {
	e.tableResult = keybase1.UserSummarySet{}
	for _, track := range filteredTracks {
		linkID := track.LinkID
		entry := keybase1.UserSummary{
			Uid:      track.Uid,
			Username: track.Username,
			LinkID:   &linkID,
			FullName: fullNames[track.Uid],
		}
		e.tableResult.Users = append(e.tableResult.Users, entry)
	}
	return nil
}

func condenseRecord(t keybase1.RemoteTrack) (*jsonw.Wrapper, error) {
	out := jsonw.NewDictionary()
	err := out.SetKey("uid", libkb.UIDWrapper(t.Uid))
	if err != nil {
		return nil, err
	}
	err = out.SetKey("username", jsonw.NewString(t.Username))
	if err != nil {
		return nil, err
	}
	err = out.SetKey("link_id", jsonw.NewString(t.LinkID.String()))
	if err != nil {
		return nil, err
	}

	return out, nil
}

func (e *ListTrackingEngine) runJSON(m libkb.MetaContext, filteredTracks []keybase1.RemoteTrack, verbose bool) error {
	var tmp []*jsonw.Wrapper
	for _, track := range filteredTracks {
		var rec *jsonw.Wrapper
		var e2 error
		if rec, e2 = condenseRecord(track); e2 != nil {
			m.Warning("In conversion to JSON: %s", e2)
		}
		if e2 == nil {
			tmp = append(tmp, rec)
		}
	}

	ret := jsonw.NewArray(len(tmp))
	for i, r := range tmp {
		if err := ret.SetIndex(i, r); err != nil {
			return err
		}
	}

	e.jsonResult = ret.MarshalPretty()
	return nil
}

func (e *ListTrackingEngine) TableResult() keybase1.UserSummarySet {
	return e.tableResult
}

func (e *ListTrackingEngine) JSONResult() string {
	return e.jsonResult
}
