package git

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func DeleteMetadata(ctx context.Context, g *libkb.GlobalContext, folder keybase1.Folder, repoName keybase1.GitRepoName) error {
	teamer := NewTeamer(g)

	teamIDVis, err := teamer.LookupOrCreate(ctx, folder)
	if err != nil {
		return err
	}

	// The GUI doesn't give us the repo_id back, so we need to figure it out.
	repos, err := GetMetadata(ctx, g, folder)
	if err != nil {
		return err
	}
	var repoID keybase1.RepoID
	for _, repo := range repos {
		if repo.LocalMetadata.RepoName == repoName {
			repoID = repo.RepoID
			break
		}
	}
	if repoID == "" {
		return fmt.Errorf("can't find repo named \"%s\"", repoName)
	}

	apiArg := libkb.APIArg{
		Endpoint:    "kbfs/git/team/delete",
		SessionType: libkb.APISessionTypeREQUIRED,
		NetContext:  ctx,
		Args: libkb.HTTPArgs{
			"team_id": libkb.S{Val: string(teamIDVis.TeamID)},
			"repo_id": libkb.S{Val: string(repoID)},
		},
	}
	_, err = g.GetAPI().Post(apiArg)
	if err != nil {
		return err
	}

	g.NotifyRouter.HandleRepoDeleted(ctx, folder, teamIDVis.TeamID, repoID, formatUniqueRepoID(teamIDVis.TeamID, repoID))

	return nil
}
