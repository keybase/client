// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
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
		BaseHandler:  NewBaseHandler(xp),
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

func (h *GitHandler) CreateGitRepo(ctx context.Context, arg keybase1.CreateGitRepoArg) (keybase1.RepoID, error) {
	return "", nil
}
