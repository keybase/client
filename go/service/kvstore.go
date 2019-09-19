// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// RPC handlers for kvstore operations

package service

import (
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
	team, _, _, err = teams.LookupOrCreateImplicitTeam(mctx.Ctx(), mctx.G(), userInputTeamName, false)
	return team, err
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
	var apiRes getEntryAPIRes
	apiArg := libkb.APIArg{
		Endpoint:    "team/storage",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"team_id":   libkb.S{Val: team.ID.String()},
			"namespace": libkb.S{Val: arg.Namespace},
			"entry_key": libkb.S{Val: arg.EntryKey},
		},
	}
	err = mctx.G().API.GetDecode(mctx, apiArg, &apiRes)
	if err != nil {
		return res, err
	}
	cleartext, err := kvstore.Unbox(apiRes.Ciphertext)
	if err != nil {
		return res, err
	}
	res = keybase1.KVEntry{
		TeamName:   arg.TeamName,
		Namespace:  apiRes.Namespace,
		EntryKey:   apiRes.EntryKey,
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
			"revision":           libkb.I{Val: 1},
		},
	}
	var apiRes putEntryAPIRes
	err = mctx.G().API.PostDecode(mctx, apiArg, &apiRes)
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
