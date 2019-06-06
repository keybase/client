package git

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func DeleteMetadata(ctx context.Context, g *libkb.GlobalContext, folder keybase1.FolderHandle, repoName keybase1.GitRepoName) error {
	teamer := NewTeamer(g)
	mctx := libkb.NewMetaContext(ctx, g)

	teamIDVis, err := teamer.LookupOrCreate(ctx, folder)
	if err != nil {
		return err
	}

	repos, err := GetMetadata(ctx, g, folder)
	if err != nil {
		return err
	}
	var repoID keybase1.RepoID
	for _, repoResult := range repos {
		repo, err := repoResult.GetIfOk()
		if err != nil {
			mctx.Debug("%v", err)
			continue
		}
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
		Args: libkb.HTTPArgs{
			"team_id": libkb.S{Val: string(teamIDVis.TeamID)},
			"repo_id": libkb.S{Val: string(repoID)},
		},
	}
	_, err = mctx.G().GetAPI().Post(mctx, apiArg)
	return err
}
