package teambot

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
)

// HandleNewTeambotKey checks that the bot's team cache has at least up to the
// generation just created.
func HandleNewTeambotKey(mctx libkb.MetaContext, teamID keybase1.TeamID,
	app keybase1.TeamApplication, generation keybase1.TeambotKeyGeneration) (err error) {
	defer mctx.TraceTimed("HandleNewTeambotKey", func() error { return err })()
	defer func() {
		mctx.G().NotifyRouter.HandleNewTeambotKey(mctx.Ctx(), teamID, app, generation)
	}()

	team, err := teams.Load(mctx.Ctx(), mctx.G(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	if err != nil {
		return err
	}
	if team.Generation() < keybase1.PerTeamKeyGeneration(generation) {
		team, err := teams.Load(mctx.Ctx(), mctx.G(), keybase1.LoadTeamArg{
			ID:          teamID,
			ForceRepoll: true,
		})
		if err != nil {
			return err
		}
		if team.Generation() < keybase1.PerTeamKeyGeneration(generation) {
			return fmt.Errorf("HandleNewTeambotKey: Found max PerTeamGeneration %d vs NewTeambotKey generation %d",
				team.Generation(), generation)
		}
	}
	return nil
}

// HandleTeambotEKNeeded forces a teambot key to be generated since the bot does
// not have access. All team members are notified and race to publish the
// requested key.
func HandleTeambotKeyNeeded(mctx libkb.MetaContext, teamID keybase1.TeamID, botUID keybase1.UID,
	app keybase1.TeamApplication, generation keybase1.TeambotKeyGeneration) (err error) {
	defer mctx.TraceTimed("HandleTeambotKeyNeeded", func() error { return err })()
	defer func() {
		mctx.G().NotifyRouter.HandleTeambotKeyNeeded(mctx.Ctx(), teamID, botUID, app, generation)
	}()

	keyer := mctx.G().GetTeambotMemberKeyer()
	if keyer == nil {
		return fmt.Errorf("member keyer not found")
	}

	team, err := teams.Load(mctx.Ctx(), mctx.G(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	if err != nil {
		return err
	}

	// Clear out our caches so we can force publish a key
	var appKey keybase1.TeamApplicationKey
	if generation == 0 { // Bot needs the latest key
		keyer.PurgeCache(mctx)
		appKey, err = team.ApplicationKey(mctx.Ctx(), app)
		if err != nil {
			return err
		}
	} else { // Bot needs a specific generation
		keyer.PurgeCacheAtGeneration(mctx, teamID, botUID, app, generation)
		appKey, err = team.ApplicationKeyAtGeneration(mctx.Ctx(), app,
			keybase1.PerTeamKeyGeneration(generation))
		if err != nil {
			return err
		}
	}

	_, _, err = keyer.GetOrCreateTeambotKey(mctx, teamID, botUID.ToBytes(), appKey)
	return err
}
