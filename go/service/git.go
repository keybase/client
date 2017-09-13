// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"

	"github.com/keybase/client/go/git"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type GitHandler struct {
	*BaseHandler
	libkb.Contextified
}

var _ keybase1.GitInterface = (*GitHandler)(nil)

func NewGitHandler(xp rpc.Transporter, g *libkb.GlobalContext) *GitHandler {
	return &GitHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *GitHandler) PutGitMetadata(ctx context.Context, arg keybase1.PutGitMetadataArg) error {
	return git.PutMetadata(ctx, h.G(), arg)
}

func (h *GitHandler) GetGitMetadata(ctx context.Context, folder keybase1.Folder) ([]keybase1.GitRepoResult, error) {
	return git.GetMetadata(ctx, h.G(), folder)
}

func (h *GitHandler) GetAllGitMetadata(ctx context.Context) ([]keybase1.GitRepoResult, error) {
	return git.GetAllMetadata(ctx, h.G())
}

func (h *GitHandler) CreatePersonalRepo(ctx context.Context, repoName keybase1.GitRepoName) (keybase1.RepoID, error) {
	client, err := h.kbfsClient()
	if err != nil {
		return "", err
	}
	folder := keybase1.Folder{
		Name:       h.G().Env.GetUsername().String(),
		FolderType: keybase1.FolderType_PRIVATE,
	}
	carg := keybase1.CreateRepoArg{
		Folder: folder,
		Name:   repoName,
	}
	return client.CreateRepo(ctx, carg)
}

func (h *GitHandler) CreateTeamRepo(ctx context.Context, arg keybase1.CreateTeamRepoArg) (keybase1.RepoID, error) {
	client, err := h.kbfsClient()
	if err != nil {
		return "", err
	}
	folder := keybase1.Folder{
		Name:       arg.TeamName.String(),
		FolderType: keybase1.FolderType_TEAM,
	}
	carg := keybase1.CreateRepoArg{
		Folder: folder,
		Name:   arg.RepoName,
	}
	return client.CreateRepo(ctx, carg)
}

func (h *GitHandler) kbfsClient() (*keybase1.KBFSGitClient, error) {
	if !h.G().ActiveDevice.Valid() {
		return nil, libkb.LoginRequiredError{}
	}
	if h.G().ConnectionManager == nil {
		return nil, fmt.Errorf("no connection manager available")
	}
	xp := h.G().ConnectionManager.LookupByClientType(keybase1.ClientType_KBFS)
	if xp == nil {
		return nil, libkb.KBFSNotRunningError{}
	}
	return &keybase1.KBFSGitClient{
		Cli: rpc.NewClient(
			xp, libkb.NewContextifiedErrorUnwrapper(h.G()), libkb.LogTagsFromContext),
	}, nil
}
