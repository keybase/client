package tlfupgrade

import (
	"context"
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

func UpgradeTLFForKBFS(ctx context.Context, g *libkb.GlobalContext, tlfName string, public bool) (err error) {
	defer g.CTraceTimed(ctx, fmt.Sprintf("UpgradeTLFForKBFS(%s,%v)", tlfName, public),
		func() error { return err })()

	// Set up KBFS connection
	if g.ConnectionManager == nil {
		return errors.New("not connection manager available")
	}
	xp := g.ConnectionManager.LookupByClientType(keybase1.ClientType_KBFS)
	if xp == nil {
		return libkb.KBFSNotRunningError{}
	}
	keysCli := &keybase1.TlfKeysClient{
		Cli: rpc.NewClient(xp, libkb.NewContextifiedErrorUnwrapper(g), libkb.LogTagsFromContext),
	}
	upgradeCli := &keybase1.ImplicitTeamMigrationClient{
		Cli: rpc.NewClient(xp, libkb.NewContextifiedErrorUnwrapper(g), libkb.LogTagsFromContext),
	}

	// Run migration
	ft := keybase1.FolderType_PRIVATE
	if public {
		ft = keybase1.FolderType_PUBLIC
	}
	folder := keybase1.Folder{
		Name:       tlfName,
		Private:    !public,
		FolderType: ft,
	}
	if err := upgradeCli.StartMigration(ctx, folder); err != nil {
		return err
	}
	keysRes, err := keysCli.GetTLFCryptKeys(ctx, keybase1.TLFQuery{
		TlfName:          folder.Name,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_GUI,
	})
	if err != nil {
		return err
	}
	if err := teams.UpgradeTLFIDToImpteam(ctx, g, folder.Name, keysRes.NameIDBreaks.TlfID,
		!folder.Private, keybase1.TeamApplication_KBFS, keysRes.CryptKeys); err != nil {
		return err
	}
	if err := upgradeCli.FinalizeMigration(ctx, folder); err != nil {
		return err
	}
	return nil
}
