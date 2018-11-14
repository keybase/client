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
	ctx = libkb.WithLogTag(ctx, "KBFSUP")
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
	g.Log.CDebugf(ctx, "UpgradeTLFForKBFS: starting migration on KBFS daemon")
	if err := upgradeCli.StartMigration(ctx, folder); err != nil {
		return err
	}
	var tlfID keybase1.TLFID
	var cryptKeys []keybase1.CryptKey
	query := keybase1.TLFQuery{
		TlfName:          folder.Name,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_SKIP,
	}
	if !public {
		g.Log.CDebugf(ctx, "UpgradeTLFForKBFS: fetching TLF crypt keys")
		keysRes, err := keysCli.GetTLFCryptKeys(ctx, query)
		if err != nil {
			return err
		}
		cryptKeys = keysRes.CryptKeys
		tlfID = keysRes.NameIDBreaks.TlfID
	} else {
		g.Log.CDebugf(ctx, "UpgradeTLFForKBFS: getting public TLFID")
		pres, err := keysCli.GetPublicCanonicalTLFNameAndID(ctx, query)
		if err != nil {
			return err
		}
		tlfID = pres.TlfID
	}
	g.Log.CDebugf(ctx, "UpgradeTLFForKBFS: posting crypt keys to the team")
	if err := teams.UpgradeTLFIDToImpteam(ctx, g, folder.Name, tlfID,
		!folder.Private, keybase1.TeamApplication_KBFS, cryptKeys); err != nil {
		return err
	}
	g.Log.CDebugf(ctx, "UpgradeTLFForKBFS: finalizing migration")
	if err := upgradeCli.FinalizeMigration(ctx, folder); err != nil {
		return err
	}
	return nil
}
