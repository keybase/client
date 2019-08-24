// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"errors"
	"fmt"
	"time"

	"github.com/keybase/client/go/git"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type GitHandler struct {
	*BaseHandler
	libkb.Contextified
}

var _ keybase1.GitInterface = (*GitHandler)(nil)

const (
	gitDefaultMaxLooseRefs         = 50
	gitDefaultPruneMinLooseObjects = 50
	gitDefaultPruneExpireAge       = 14 * 24 * time.Hour
	gitDefaultMaxObjectPacks       = 50
)

func NewGitHandler(xp rpc.Transporter, g *libkb.GlobalContext) *GitHandler {
	return &GitHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *GitHandler) PutGitMetadata(ctx context.Context, arg keybase1.PutGitMetadataArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "GIT")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf(
		"git:PutGitMetadata(%v, %v, %v)", arg.RepoID, arg.Folder.Name, arg.Folder.FolderType),
		func() error { return err })()

	return git.PutMetadata(ctx, h.G(), arg)
}

func (h *GitHandler) DeleteGitMetadata(ctx context.Context, arg keybase1.DeleteGitMetadataArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "GIT")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf(
		"git:DeleteGitMetadata(%v, %v)", arg.Folder.Name, arg.Folder.FolderType),
		func() error { return err })()

	return git.DeleteMetadata(ctx, h.G(), arg.Folder, arg.RepoName)
}

func (h *GitHandler) GetGitMetadata(ctx context.Context, folder keybase1.FolderHandle) (res []keybase1.GitRepoResult, err error) {
	ctx = libkb.WithLogTag(ctx, "GIT")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf(
		"git:GetGitMetadata(%v, %v)", folder.Name, folder.FolderType),
		func() error { return err })()

	return git.GetMetadata(ctx, h.G(), folder)
}

func (h *GitHandler) GetAllGitMetadata(ctx context.Context) (res []keybase1.GitRepoResult, err error) {
	ctx = libkb.WithLogTag(ctx, "GIT")
	defer h.G().CTraceTimed(ctx, "git:GetAllGitMetadata", func() error { return err })()

	return git.GetAllMetadata(ctx, h.G())
}

// In several cases (implicit admins doing anything, writers doing deletes),
// KBFS will allow or give confusing error messages for operations that don't
// have the right permissions. Doing an explicit check for these helps us give
// clear errors.
//
// Note that the minimumRole here does *not* respect implicit adminship.
func isRoleAtLeast(ctx context.Context, g *libkb.GlobalContext, teamName string, public bool, minimumRole keybase1.TeamRole) (bool, error) {
	team, err := teams.Load(ctx, g, keybase1.LoadTeamArg{
		Name:        teamName,
		Public:      public,
		ForceRepoll: true,
	})
	if err != nil {
		return false, err
	}
	self, _, err := g.GetUPAKLoader().LoadV2(libkb.NewLoadUserSelfAndUIDArg(g))
	if err != nil {
		return false, err
	}
	role, err := team.MemberRole(ctx, self.Current.ToUserVersion())
	if err != nil {
		return false, fmt.Errorf("self role missing from team %s", teamName)
	}
	return role.IsOrAbove(minimumRole), nil
}

func (h *GitHandler) createRepo(ctx context.Context, folder keybase1.FolderHandle, repoName keybase1.GitRepoName, notifyTeam bool) (repoID keybase1.RepoID, err error) {
	ctx = libkb.WithLogTag(ctx, "GIT")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf(
		"git:createRepo(%v, %v)", folder.Name, folder.FolderType),
		func() error { return err })()

	client, err := h.kbfsClient()
	if err != nil {
		return "", err
	}

	carg := keybase1.CreateRepoArg{
		Folder: folder,
		Name:   repoName,
	}
	repoID, err = client.CreateRepo(ctx, carg)
	if err != nil {
		// Real user errors are going to come through this path, like "repo
		// already exists". Make them clear for the user.
		return "", git.HumanizeGitErrors(ctx, h.G(), err)
	}

	// Currently KBFS will also call back into the service to put metadata
	// after a create, so the put might happen twice, but we don't want to
	// depend on that behavior.
	err = git.PutMetadata(ctx, h.G(), keybase1.PutGitMetadataArg{
		Folder: folder,
		RepoID: repoID,
		Metadata: keybase1.GitLocalMetadata{
			RepoName: repoName,
		},
		NotifyTeam: notifyTeam,
	})
	if err != nil {
		return "", err
	}

	return repoID, nil
}

func (h *GitHandler) CreatePersonalRepo(ctx context.Context, repoName keybase1.GitRepoName) (repoID keybase1.RepoID, err error) {
	ctx = libkb.WithLogTag(ctx, "GIT")
	defer h.G().CTraceTimed(ctx, "git:CreatePersonalRepo", func() error { return err })()

	folder := keybase1.FolderHandle{
		Name:       h.G().Env.GetUsername().String(),
		FolderType: keybase1.FolderType_PRIVATE,
	}
	return h.createRepo(ctx, folder, repoName, false /* notifyTeam */)
}

func (h *GitHandler) CreateTeamRepo(ctx context.Context, arg keybase1.CreateTeamRepoArg) (repoID keybase1.RepoID, err error) {
	ctx = libkb.WithLogTag(ctx, "GIT")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf(
		"git:CreateTeamRepo(%v)", arg.TeamName),
		func() error { return err })()

	// Only support private teams
	public := false

	// This prevents implicit admins from getting a confusing error message.
	isWriter, err := isRoleAtLeast(ctx, h.G(), arg.TeamName.String(), public, keybase1.TeamRole_WRITER)
	if err != nil {
		return "", err
	}
	if !isWriter {
		return "", fmt.Errorf("Only team writers may create git repos.")
	}

	folder := keybase1.FolderHandle{
		Name:       arg.TeamName.String(),
		FolderType: keybase1.FolderType_TEAM,
	}
	return h.createRepo(ctx, folder, arg.RepoName, arg.NotifyTeam)
}

func (h *GitHandler) DeletePersonalRepo(ctx context.Context, repoName keybase1.GitRepoName) (err error) {
	ctx = libkb.WithLogTag(ctx, "GIT")
	defer h.G().CTraceTimed(ctx, "git:DeletePersonalRepo",
		func() error { return err })()

	client, err := h.kbfsClient()
	if err != nil {
		return err
	}
	folder := keybase1.FolderHandle{
		Name:       h.G().Env.GetUsername().String(),
		FolderType: keybase1.FolderType_PRIVATE,
	}
	darg := keybase1.DeleteRepoArg{
		Folder: folder,
		Name:   repoName,
	}
	err = client.DeleteRepo(ctx, darg)
	if err != nil {
		switch err.(type) {
		case libkb.RepoDoesntExistError:
			h.G().Log.Warning("Git repo doesn't exist. Deleting metadata anyway.")
		default:
			return err
		}
	}

	// Delete the repo metadata from the Keybase server.
	err = git.DeleteMetadata(ctx, h.G(), folder, repoName)
	return git.HumanizeGitErrors(ctx, h.G(), err)
}

func (h *GitHandler) DeleteTeamRepo(ctx context.Context, arg keybase1.DeleteTeamRepoArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "GIT")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf(
		"git:DeleteTeamRepo(%v)", arg.TeamName),
		func() error { return err })()

	// Only support private teams
	public := false

	// First make sure the user is an admin of the team. KBFS doesn't directly
	// enforce this requirement, so a non-admin could get around it by hacking
	// up their own client, but they could already wreak a lot of abuse by
	// pushing garbage to the repo, so we don't consider this a big deal.
	isAdmin, err := isRoleAtLeast(ctx, h.G(), arg.TeamName.String(), public, keybase1.TeamRole_ADMIN)
	if err != nil {
		return err
	}
	if !isAdmin {
		return fmt.Errorf("Only team admins may delete git repos.")
	}

	client, err := h.kbfsClient()
	if err != nil {
		return err
	}
	folder := keybase1.FolderHandle{
		Name:       arg.TeamName.String(),
		FolderType: keybase1.FolderType_TEAM,
	}
	darg := keybase1.DeleteRepoArg{
		Folder: folder,
		Name:   arg.RepoName,
	}
	err = client.DeleteRepo(ctx, darg)
	if err != nil {
		switch err.(type) {
		case libkb.RepoDoesntExistError:
			h.G().Log.Warning("Git repo doesn't exist. Deleting metadata anyway.")
		default:
			return err
		}
	}

	// Delete the repo metadata from the Keybase server.
	err = git.DeleteMetadata(ctx, h.G(), folder, arg.RepoName)
	return git.HumanizeGitErrors(ctx, h.G(), err)
}

func (h *GitHandler) GcPersonalRepo(ctx context.Context, arg keybase1.GcPersonalRepoArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "GIT")
	defer h.G().CTraceTimed(ctx, "git:GCPersonalRepo",
		func() error { return err })()

	client, err := h.kbfsClient()
	if err != nil {
		return err
	}
	folder := keybase1.FolderHandle{
		Name:       h.G().Env.GetUsername().String(),
		FolderType: keybase1.FolderType_PRIVATE,
	}
	options := keybase1.GcOptions{}
	if !arg.Force {
		options.MaxLooseRefs = gitDefaultMaxLooseRefs
		options.MaxObjectPacks = gitDefaultMaxObjectPacks
	}
	gcarg := keybase1.GcArg{
		Folder:  folder,
		Name:    arg.RepoName,
		Options: options,
	}
	err = client.Gc(ctx, gcarg)
	if err != nil {
		return git.HumanizeGitErrors(ctx, h.G(), err)
	}
	return nil
}

func (h *GitHandler) GcTeamRepo(ctx context.Context, arg keybase1.GcTeamRepoArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "GIT")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf(
		"git:GcTeamRepo(%v)", arg.TeamName),
		func() error { return err })()

	// Only support private teams
	public := false

	// First make sure the user is a writer of the team.
	isWriter, err := isRoleAtLeast(ctx, h.G(), arg.TeamName.String(), public, keybase1.TeamRole_WRITER)
	if err != nil {
		return err
	}
	if !isWriter {
		return fmt.Errorf("Only writers may garbage collect git repos.")
	}

	client, err := h.kbfsClient()
	if err != nil {
		return err
	}
	folder := keybase1.FolderHandle{
		Name:       arg.TeamName.String(),
		FolderType: keybase1.FolderType_TEAM,
	}
	options := keybase1.GcOptions{
		PruneExpireTime: keybase1.ToTime(
			time.Now().Add(-gitDefaultPruneExpireAge)),
	}
	if !arg.Force {
		options.MaxLooseRefs = gitDefaultMaxLooseRefs
		options.PruneMinLooseObjects = gitDefaultPruneMinLooseObjects
	}
	gcarg := keybase1.GcArg{
		Folder:  folder,
		Name:    arg.RepoName,
		Options: options,
	}
	err = client.Gc(ctx, gcarg)
	if err != nil {
		return git.HumanizeGitErrors(ctx, h.G(), err)
	}
	return nil
}

func (h *GitHandler) GetTeamRepoSettings(ctx context.Context, arg keybase1.GetTeamRepoSettingsArg) (keybase1.GitTeamRepoSettings, error) {
	return git.GetTeamRepoSettings(ctx, h.G(), arg)
}

func (h *GitHandler) SetTeamRepoSettings(ctx context.Context, arg keybase1.SetTeamRepoSettingsArg) error {
	return git.SetTeamRepoSettings(ctx, h.G(), arg)
}

func (h *GitHandler) kbfsClient() (*keybase1.KBFSGitClient, error) {
	if !h.G().ActiveDevice.Valid() {
		return nil, libkb.LoginRequiredError{}
	}
	if h.G().ConnectionManager == nil {
		return nil, errors.New("no connection manager available")
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
