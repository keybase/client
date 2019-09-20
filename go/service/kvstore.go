// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// RPC handlers for kvstore operations

package service

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/kvstore"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type KVStoreHandler struct {
	*BaseHandler
	libkb.Contextified
}

var _ keybase1.KvstoreInterface = (*KVStoreHandler)(nil)

func NewKVStoreHandler(xp rpc.Transporter, g *libkb.GlobalContext) *KVStoreHandler {
	if g.GetKVRevisionCache() == nil {
		g.SetKVRevisionCache(kvstore.NewKVRevisionCache())
	}
	return &KVStoreHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *KVStoreHandler) assertLoggedIn(ctx context.Context) error {
	loggedIn := h.G().ActiveDevice.Valid()
	if !loggedIn {
		return libkb.LoginRequiredError{}
	}
	return nil
}

func (h *KVStoreHandler) resolveTeam(mctx libkb.MetaContext, userInputTeamName string) (team *teams.Team, err error) {
	if strings.Contains(userInputTeamName, ",") {
		// it's an implicit team
		team, _, _, err = teams.LookupOrCreateImplicitTeam(mctx.Ctx(), mctx.G(), userInputTeamName, false)
		return team, err
	}
	return teams.Load(mctx.Ctx(), mctx.G(), keybase1.LoadTeamArg{Name: userInputTeamName})
}

type getEntryAPIRes struct {
	Status            libkb.AppStatus `json:"status"`
	TeamID            string          `json:"team_id"`
	Namespace         string          `json:"namespace"`
	EntryKey          string          `json:"entry_key"`
	TeamKeyGen        int             `json:"team_key_gen"`
	Revision          int             `json:"revision"`
	Ciphertext        string          `json:"ciphertext"`
	CiphertextVersion int             `json:"ciphertext_version"`
	FormatVersion     int             `json:"format_version"`
	WriterUID         string          `json:"uid"`
	WriterEldestSeqno int             `json:"eldest_seqno"`
	WriterDeviceID    string          `json:"device_id"`
}

func (k *getEntryAPIRes) GetAppStatus() *libkb.AppStatus {
	return &k.Status
}

func (h *KVStoreHandler) serverFetch(mctx libkb.MetaContext, teamID keybase1.TeamID, namespace, entryKey string) (res getEntryAPIRes, err error) {
	var apiRes getEntryAPIRes
	apiArg := libkb.APIArg{
		Endpoint:    "team/storage",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"team_id":   libkb.S{Val: teamID.String()},
			"namespace": libkb.S{Val: namespace},
			"entry_key": libkb.S{Val: entryKey},
		},
	}
	err = mctx.G().API.GetDecode(mctx, apiArg, &apiRes)
	if err != nil {
		return res, err
	}
	entryHash := kvstore.Hash(apiRes.Ciphertext)
	err = mctx.G().GetKVRevisionCache().Check(teamID, namespace, entryKey, entryHash, apiRes.TeamKeyGen, apiRes.Revision)
	if err != nil {
		return res, err
	}
	return apiRes, nil
}

func (h *KVStoreHandler) GetKVEntry(ctx context.Context, arg keybase1.GetKVEntryArg) (res keybase1.KVEntry, err error) {
	ctx = libkb.WithLogTag(ctx, "KV")
	if err := h.assertLoggedIn(ctx); err != nil {
		return res, err
	}
	mctx := libkb.NewMetaContext(ctx, h.G())
	team, err := h.resolveTeam(mctx, arg.TeamName)
	if err != nil {
		return res, err
	}
	apiRes, err := h.serverFetch(mctx, team.ID, arg.Namespace, arg.EntryKey)
	if err != nil {
		return res, err
	}
	cleartext, err := kvstore.Unbox(apiRes.Ciphertext)
	if err != nil {
		return res, err
	}
	res = keybase1.KVEntry{
		TeamName:   arg.TeamName,
		Namespace:  arg.Namespace,
		EntryKey:   arg.EntryKey,
		EntryValue: cleartext,
		Revision:   apiRes.Revision,
	}
	return res, nil
}

type putEntryAPIRes struct {
	Status   libkb.AppStatus `json:"status"`
	Revision int             `json:"revision"`
}

func (k *putEntryAPIRes) GetAppStatus() *libkb.AppStatus {
	return &k.Status
}

func (h *KVStoreHandler) fetchRevisionFromCacheOrServer(mctx libkb.MetaContext, teamID keybase1.TeamID, namespace, entryKey string) (int, error) {
	prevRevision := mctx.G().GetKVRevisionCache().FetchRevision(teamID, namespace, entryKey)
	if prevRevision == 0 {
		// not in the cache. check if it's in the server.
		serverRes, err := h.serverFetch(mctx, teamID, namespace, entryKey)
		if err != nil {
			return 0, err
		}
		prevRevision = serverRes.Revision
	}
	return prevRevision, nil
}

func (h *KVStoreHandler) PutKVEntry(ctx context.Context, arg keybase1.PutKVEntryArg) (res keybase1.KVPutResult, err error) {
	ctx = libkb.WithLogTag(ctx, "KV")
	if err := h.assertLoggedIn(ctx); err != nil {
		return res, err
	}
	mctx := libkb.NewMetaContext(ctx, h.G())
	team, err := h.resolveTeam(mctx, arg.TeamName)
	if err != nil {
		return res, err
	}
	ciphertext, err := kvstore.Box(arg.EntryValue)
	if err != nil {
		return res, err
	}
	prevRevision, err := h.fetchRevisionFromCacheOrServer(mctx, team.ID, arg.Namespace, arg.EntryKey)

	apiArg := libkb.APIArg{
		Endpoint:    "team/storage",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"team_id":            libkb.S{Val: team.ID.String()},
			"team_key_gen":       libkb.I{Val: int(team.Generation())},
			"namespace":          libkb.S{Val: arg.Namespace},
			"entry_key":          libkb.S{Val: arg.EntryKey},
			"ciphertext":         libkb.S{Val: ciphertext},
			"ciphertext_version": libkb.I{Val: 1},
			"revision":           libkb.I{Val: prevRevision + 1},
		},
	}
	var apiRes putEntryAPIRes
	err = mctx.G().API.PostDecode(mctx, apiArg, &apiRes)
	if err != nil {
		return res, err
	}
	if apiRes.Revision != prevRevision+1 {
		return res, fmt.Errorf("kvstore PUT revision error. expected %d, got %d", prevRevision+1, apiRes.Revision)
	}
	entryHash := kvstore.Hash(ciphertext)
	err = mctx.G().GetKVRevisionCache().Check(team.ID, arg.Namespace, arg.EntryKey, entryHash, int(team.Generation()), apiRes.Revision)
	if err != nil {
		return res, err
	}
	return keybase1.KVPutResult{
		TeamName:  arg.TeamName,
		Namespace: arg.Namespace,
		EntryKey:  arg.EntryKey,
		Revision:  apiRes.Revision,
	}, nil
}
