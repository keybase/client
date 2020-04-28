// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// RPC handlers for kvstore operations

package service

import (
	"fmt"
	"strings"
	"sync"

	"github.com/keybase/client/go/kvstore"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type KVStoreHandler struct {
	*BaseHandler
	sync.Mutex
	libkb.Contextified
	Boxer kvstore.KVStoreBoxer
}

var _ keybase1.KvstoreInterface = (*KVStoreHandler)(nil)

func NewKVStoreHandler(xp rpc.Transporter, g *libkb.GlobalContext) *KVStoreHandler {
	if g.GetKVRevisionCache() == nil {
		g.SetKVRevisionCache(kvstore.NewKVRevisionCache(g))
	}
	return &KVStoreHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
		Boxer:        kvstore.NewKVStoreBoxer(g),
	}
}

func (h *KVStoreHandler) resolveTeam(mctx libkb.MetaContext, userInputTeamName string) (teamID keybase1.TeamID, err error) {
	if strings.Contains(userInputTeamName, ",") {
		// it's an implicit team that might not exist yet
		team, _, _, err := teams.LookupOrCreateImplicitTeam(mctx.Ctx(), mctx.G(), userInputTeamName, false /*public*/)
		if err != nil {
			mctx.Debug("error loading implicit team %s: %v", userInputTeamName, err)
			err = libkb.AppStatusError{
				Code: libkb.SCTeamReadError,
				Desc: "You are not a member of this team",
			}
			return teamID, err
		}
		return team.ID, nil
	}
	teamID, err = teams.GetTeamIDByNameRPC(mctx, userInputTeamName)
	if err != nil {
		mctx.Debug("error resolving team with name %s: %v", userInputTeamName, err)
	}
	return teamID, err
}

type getEntryAPIRes struct {
	libkb.AppStatusEmbed
	TeamID            keybase1.TeamID               `json:"team_id"`
	Namespace         string                        `json:"namespace"`
	EntryKey          string                        `json:"entry_key"`
	TeamKeyGen        keybase1.PerTeamKeyGeneration `json:"team_key_gen"`
	Revision          int                           `json:"revision"`
	Ciphertext        *string                       `json:"ciphertext"`
	FormatVersion     int                           `json:"format_version"`
	WriterUID         keybase1.UID                  `json:"uid"`
	WriterEldestSeqno keybase1.Seqno                `json:"eldest_seqno"`
	WriterDeviceID    keybase1.DeviceID             `json:"device_id"`
}

func (h *KVStoreHandler) serverFetch(mctx libkb.MetaContext, entryID keybase1.KVEntryID) (emptyRes getEntryAPIRes, err error) {
	var apiRes getEntryAPIRes
	apiArg := libkb.APIArg{
		Endpoint:    "team/storage",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"team_id":   libkb.S{Val: entryID.TeamID.String()},
			"namespace": libkb.S{Val: entryID.Namespace},
			"entry_key": libkb.S{Val: entryID.EntryKey},
		},
	}
	err = mctx.G().API.GetDecode(mctx, apiArg, &apiRes)
	if err != nil {
		mctx.Debug("error fetching %+v from server: %v", entryID, err)
		return emptyRes, err
	}
	if apiRes.TeamID != entryID.TeamID {
		return emptyRes, fmt.Errorf("api returned an unexpected teamID: %s isn't %s", apiRes.TeamID, entryID.TeamID)
	}
	if apiRes.Namespace != entryID.Namespace {
		return emptyRes, fmt.Errorf("api returned an unexpected namespace: %s isn't %s", apiRes.Namespace, entryID.Namespace)
	}
	if apiRes.EntryKey != entryID.EntryKey {
		return emptyRes, fmt.Errorf("api returned an unexpected entryKey: %s isn't %s", apiRes.EntryKey, entryID.EntryKey)
	}
	return apiRes, nil
}

func (h *KVStoreHandler) GetKVEntry(ctx context.Context, arg keybase1.GetKVEntryArg) (res keybase1.KVGetResult, err error) {
	h.Lock()
	defer h.Unlock()
	return h.getKVEntryLocked(ctx, arg)
}

func (h *KVStoreHandler) getKVEntryLocked(ctx context.Context, arg keybase1.GetKVEntryArg) (res keybase1.KVGetResult, err error) {
	ctx = libkb.WithLogTag(ctx, "KV")
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.Trace(fmt.Sprintf("KVStoreHandler#GetKVEntry: t:%s, n:%s, k:%s", arg.TeamName, arg.Namespace, arg.EntryKey), &err)()

	if err := assertLoggedIn(ctx, h.G()); err != nil {
		mctx.Debug("not logged in err: %v", err)
		return res, err
	}
	teamID, err := h.resolveTeam(mctx, arg.TeamName)
	if err != nil {
		return res, err
	}
	entryID := keybase1.KVEntryID{
		TeamID:    teamID,
		Namespace: arg.Namespace,
		EntryKey:  arg.EntryKey,
	}
	apiRes, err := h.serverFetch(mctx, entryID)
	if err != nil {
		mctx.Debug("error fetching %+v from server: %v", entryID, err)
		return res, err
	}
	// check the server response against the local cache
	err = mctx.G().GetKVRevisionCache().Check(mctx, entryID, apiRes.Ciphertext, apiRes.TeamKeyGen, apiRes.Revision)
	if err != nil {
		err = fmt.Errorf("error comparing the entry from the server to what's in the local cache: %s", err)
		mctx.Debug("%+v: %s", entryID, err)
		return res, err
	}
	var entryValue *string
	if apiRes.Ciphertext != nil && len(*apiRes.Ciphertext) > 0 {
		// ciphertext coming back from the server is available to be unboxed (has previously been set, and was not previously deleted)
		cleartext, err := h.Boxer.Unbox(mctx, entryID, apiRes.Revision, *apiRes.Ciphertext, apiRes.TeamKeyGen, apiRes.FormatVersion, apiRes.WriterUID, apiRes.WriterEldestSeqno, apiRes.WriterDeviceID)
		if err != nil {
			mctx.Debug("error unboxing %+v: %v", entryID, err)
			return res, err
		}
		entryValue = &cleartext
	}
	err = mctx.G().GetKVRevisionCache().Put(mctx, entryID, apiRes.Ciphertext, apiRes.TeamKeyGen, apiRes.Revision)
	if err != nil {
		err = fmt.Errorf("error putting newly fetched values into the local cache: %s", err)
		mctx.Debug("%+v: %s", entryID, err)
		return res, err
	}
	return keybase1.KVGetResult{
		TeamName:   arg.TeamName,
		Namespace:  arg.Namespace,
		EntryKey:   arg.EntryKey,
		EntryValue: entryValue,
		Revision:   apiRes.Revision,
	}, nil
}

type putEntryAPIRes struct {
	libkb.AppStatusEmbed
	Revision int `json:"revision"`
}

func (h *KVStoreHandler) PutKVEntry(ctx context.Context, arg keybase1.PutKVEntryArg) (res keybase1.KVPutResult, err error) {
	h.Lock()
	defer h.Unlock()
	return h.putKVEntryLocked(ctx, arg)
}

func (h *KVStoreHandler) putKVEntryLocked(ctx context.Context, arg keybase1.PutKVEntryArg) (res keybase1.KVPutResult, err error) {
	ctx = libkb.WithLogTag(ctx, "KV")
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.Trace(fmt.Sprintf("KVStoreHandler#PutKVEntry: t:%s, n:%s, k:%s, r:%d", arg.TeamName, arg.Namespace, arg.EntryKey, arg.Revision), &err)()
	if err := assertLoggedIn(ctx, h.G()); err != nil {
		mctx.Debug("not logged in err: %v", err)
		return res, err
	}
	teamID, err := h.resolveTeam(mctx, arg.TeamName)
	if err != nil {
		return res, err
	}
	entryID := keybase1.KVEntryID{
		TeamID:    teamID,
		Namespace: arg.Namespace,
		EntryKey:  arg.EntryKey,
	}

	revision := arg.Revision
	if revision == 0 {
		// fetch to get the correct revision when it's not specified
		getRes, err := h.getKVEntryLocked(ctx, keybase1.GetKVEntryArg{
			SessionID: arg.SessionID,
			TeamName:  arg.TeamName,
			Namespace: arg.Namespace,
			EntryKey:  arg.EntryKey,
		})
		if err != nil {
			err = fmt.Errorf("error fetching the revision before writing this entry: %s", err)
			mctx.Debug("%+v: %s", entryID, err)
			return res, err
		}
		revision = getRes.Revision + 1
	}

	mctx.Debug("updating %+v to revision %d", entryID, revision)
	ciphertext, teamKeyGen, ciphertextVersion, err := h.Boxer.Box(mctx, entryID, revision, arg.EntryValue)
	if err != nil {
		mctx.Debug("error boxing %+v: %v", entryID, err)
		return res, err
	}
	err = mctx.G().GetKVRevisionCache().CheckForUpdate(mctx, entryID, revision)
	if err != nil {
		mctx.Debug("error from cache for updating %+v: %s", entryID, err)
		return res, err
	}

	apiArg := libkb.APIArg{
		Endpoint:    "team/storage",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"team_id":            libkb.S{Val: entryID.TeamID.String()},
			"team_key_gen":       libkb.I{Val: int(teamKeyGen)},
			"namespace":          libkb.S{Val: entryID.Namespace},
			"entry_key":          libkb.S{Val: entryID.EntryKey},
			"ciphertext":         libkb.S{Val: ciphertext},
			"ciphertext_version": libkb.I{Val: ciphertextVersion},
			"revision":           libkb.I{Val: revision},
		},
	}
	var apiRes putEntryAPIRes
	err = mctx.G().API.PostDecode(mctx, apiArg, &apiRes)
	if err != nil {
		mctx.Debug("error posting update for %+v to the server: %v", entryID, err)
		return res, err
	}
	if apiRes.Revision != revision {
		mctx.Debug("expected the server to return revision %d but got %d for %+v", revision, apiRes.Revision, entryID)
		return res, fmt.Errorf("kvstore PUT revision error. expected %d, got %d", revision, apiRes.Revision)
	}
	err = mctx.G().GetKVRevisionCache().Put(mctx, entryID, &ciphertext, teamKeyGen, revision)
	if err != nil {
		err = fmt.Errorf("error caching this new entry (try fetching it again): %s", err)
		mctx.Debug("%+v: %s", entryID, err)
		return res, err
	}
	return keybase1.KVPutResult{
		TeamName:  arg.TeamName,
		Namespace: arg.Namespace,
		EntryKey:  arg.EntryKey,
		Revision:  apiRes.Revision,
	}, nil
}

func (h *KVStoreHandler) DelKVEntry(ctx context.Context, arg keybase1.DelKVEntryArg) (res keybase1.KVDeleteEntryResult, err error) {
	h.Lock()
	defer h.Unlock()
	return h.delKVEntryLocked(ctx, arg)
}

func (h *KVStoreHandler) delKVEntryLocked(ctx context.Context, arg keybase1.DelKVEntryArg) (res keybase1.KVDeleteEntryResult, err error) {
	ctx = libkb.WithLogTag(ctx, "KV")
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.Trace(fmt.Sprintf("KVStoreHandler#DeleteKVEntry: t:%s, n:%s, k:%s, r:%d", arg.TeamName, arg.Namespace, arg.EntryKey, arg.Revision), &err)()
	if err := assertLoggedIn(ctx, h.G()); err != nil {
		mctx.Debug("not logged in err: %v", err)
		return res, err
	}
	teamID, err := h.resolveTeam(mctx, arg.TeamName)
	if err != nil {
		return res, err
	}
	entryID := keybase1.KVEntryID{
		TeamID:    teamID,
		Namespace: arg.Namespace,
		EntryKey:  arg.EntryKey,
	}

	revision := arg.Revision
	if revision == 0 {
		getArg := keybase1.GetKVEntryArg{
			SessionID: arg.SessionID,
			TeamName:  arg.TeamName,
			Namespace: arg.Namespace,
			EntryKey:  arg.EntryKey,
		}
		getRes, err := h.getKVEntryLocked(ctx, getArg)
		if err != nil {
			err = fmt.Errorf("error fetching the revision before deleting this entry: %s", err)
			mctx.Debug("%+v: %s", entryID, err)
			return res, err
		}
		revision = getRes.Revision + 1
	}

	mctx.Debug("deleting %+v at revision %d", entryID, revision)
	err = mctx.G().GetKVRevisionCache().CheckForUpdate(mctx, entryID, revision)
	if err != nil {
		mctx.Debug("error from cache for deleting %+v: %s", entryID, err)
		return res, err
	}
	apiArg := libkb.APIArg{
		Endpoint:    "team/storage",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"team_id":   libkb.S{Val: entryID.TeamID.String()},
			"namespace": libkb.S{Val: entryID.Namespace},
			"entry_key": libkb.S{Val: entryID.EntryKey},
			"revision":  libkb.I{Val: revision},
		},
	}
	apiRes, err := mctx.G().API.Delete(mctx, apiArg)
	if err != nil {
		mctx.Debug("error making delete request for entry %v: %v", entryID, err)
		return res, err
	}
	responseRevision, err := apiRes.Body.AtKey("revision").GetInt()
	if err != nil {
		mctx.Debug("error getting the revision from the server response: %v", err)
		err = fmt.Errorf("server response doesnt have a revision field: %s", err)
		return res, err
	}
	if responseRevision != revision {
		mctx.Debug("expected the server to return revision %d but got %d for %+v", revision, responseRevision, entryID)
		return res, fmt.Errorf("kvstore DEL revision error. expected %d, got %d", revision, responseRevision)
	}
	err = mctx.G().GetKVRevisionCache().MarkDeleted(mctx, entryID, revision)
	if err != nil {
		err = fmt.Errorf("error caching this now-deleted entry (try fetching it): %s", err)
		mctx.Debug("%+v: %s", entryID, err)
		return res, err
	}
	return keybase1.KVDeleteEntryResult{
		TeamName:  arg.TeamName,
		Namespace: arg.Namespace,
		EntryKey:  arg.EntryKey,
		Revision:  revision,
	}, nil
}

type getListNamespacesAPIRes struct {
	libkb.AppStatusEmbed
	TeamID     keybase1.TeamID `json:"team_id"`
	Namespaces []string        `json:"namespaces"`
}

func (h *KVStoreHandler) ListKVNamespaces(ctx context.Context, arg keybase1.ListKVNamespacesArg) (res keybase1.KVListNamespaceResult, err error) {
	h.Lock()
	defer h.Unlock()
	return h.listKVNamespaceLocked(ctx, arg)
}

func (h *KVStoreHandler) listKVNamespaceLocked(ctx context.Context, arg keybase1.ListKVNamespacesArg) (res keybase1.KVListNamespaceResult, err error) {
	ctx = libkb.WithLogTag(ctx, "KV")
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.Trace(fmt.Sprintf("KVStoreHandler#ListKVNamespaces: t:%s", arg.TeamName), &err)()
	if err := assertLoggedIn(ctx, h.G()); err != nil {
		mctx.Debug("not logged in err: %v", err)
		return res, err
	}
	teamID, err := h.resolveTeam(mctx, arg.TeamName)
	if err != nil {
		return res, err
	}

	var apiRes getListNamespacesAPIRes
	apiArg := libkb.APIArg{
		Endpoint:    "team/storage/list",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"team_id": libkb.S{Val: teamID.String()},
		},
	}
	err = mctx.G().API.GetDecode(mctx, apiArg, &apiRes)
	if err != nil {
		return res, err
	}
	if apiRes.TeamID != teamID {
		mctx.Debug("list KV Namespaces server returned an unexpected, mismatching teamID")
		return res, fmt.Errorf("expected teamID %s from the server, got %s", teamID, apiRes.TeamID)
	}
	return keybase1.KVListNamespaceResult{
		TeamName:   arg.TeamName,
		Namespaces: apiRes.Namespaces,
	}, nil
}

type getListEntriesAPIRes struct {
	libkb.AppStatusEmbed
	TeamID    keybase1.TeamID      `json:"team_id"`
	Namespace string               `json:"namespace"`
	EntryKeys []compressedEntryKey `json:"entry_keys"`
}

type compressedEntryKey struct {
	EntryKey string `json:"k"`
	Revision int    `json:"r"`
}

func (h *KVStoreHandler) ListKVEntries(ctx context.Context, arg keybase1.ListKVEntriesArg) (res keybase1.KVListEntryResult, err error) {
	h.Lock()
	defer h.Unlock()
	return h.listKVEntriesLocked(ctx, arg)
}

func (h *KVStoreHandler) listKVEntriesLocked(ctx context.Context, arg keybase1.ListKVEntriesArg) (res keybase1.KVListEntryResult, err error) {
	ctx = libkb.WithLogTag(ctx, "KV")
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.Trace(fmt.Sprintf("KVStoreHandler#ListKVEntries: t:%s, n:%s", arg.TeamName, arg.Namespace), &err)()
	if err := assertLoggedIn(ctx, h.G()); err != nil {
		mctx.Debug("not logged in err: %v", err)
		return res, err
	}
	teamID, err := h.resolveTeam(mctx, arg.TeamName)
	if err != nil {
		return res, err
	}
	var apiRes getListEntriesAPIRes
	apiArg := libkb.APIArg{
		Endpoint:    "team/storage/list",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"team_id":   libkb.S{Val: teamID.String()},
			"namespace": libkb.S{Val: arg.Namespace},
		},
	}
	err = mctx.G().API.GetDecode(mctx, apiArg, &apiRes)
	if err != nil {
		return res, err
	}
	if apiRes.TeamID != teamID {
		mctx.Debug("list KV Namespaces server returned an unexpected, mismatching teamID")
		return res, fmt.Errorf("expected teamID %s from the server, got %s", teamID, apiRes.TeamID)
	}
	if apiRes.Namespace != arg.Namespace {
		mctx.Debug("list KV EntryKeys server returned an unexpected, mismatching namespace")
		return res, fmt.Errorf("expected namespace %s from the server, got %s", arg.Namespace, apiRes.Namespace)
	}
	resKeys := []keybase1.KVListEntryKey{}
	for _, ek := range apiRes.EntryKeys {
		k := keybase1.KVListEntryKey{EntryKey: ek.EntryKey, Revision: ek.Revision}
		resKeys = append(resKeys, k)
	}
	return keybase1.KVListEntryResult{
		TeamName:  arg.TeamName,
		Namespace: arg.Namespace,
		EntryKeys: resKeys,
	}, nil
}
