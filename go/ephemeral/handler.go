package ephemeral

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func HandleNewTeamEK(mctx libkb.MetaContext, teamID keybase1.TeamID, generation keybase1.EkGeneration) (err error) {
	defer mctx.TraceTimed("HandleNewTeamEK", func() error { return err })()

	ekLib := mctx.G().GetEKLib()
	if ekLib == nil {
		return fmt.Errorf("ekLib not found")
	}
	ekLib.PurgeTeamEKCachesForTeamIDAndGeneration(mctx, teamID, generation)
	mctx.G().NotifyRouter.HandleNewTeamEK(mctx.Ctx(), teamID, generation)
	return nil
}

func HandleNewTeambotEK(mctx libkb.MetaContext, teamID keybase1.TeamID, generation keybase1.EkGeneration) (err error) {
	defer mctx.TraceTimed("HandleNewTeambotEK", func() error { return err })()

	ekLib := mctx.G().GetEKLib()
	if ekLib == nil {
		return fmt.Errorf("ekLib not found")
	}
	ekLib.PurgeTeambotEKCachesForTeamIDAndGeneration(mctx, teamID, generation)
	mctx.G().NotifyRouter.HandleNewTeambotEK(mctx.Ctx(), teamID, generation)
	return nil
}

// HandleTeambotEKNeeded forces a teambot ek to be generated since the bot does
// not have access. All team members are notified and race to publish the
// requested key.
func HandleTeambotEKNeeded(mctx libkb.MetaContext, teamID keybase1.TeamID, botUID keybase1.UID,
	generation keybase1.EkGeneration) (err error) {
	defer mctx.TraceTimed("HandleTeambotEKNeeded", func() error { return err })()
	defer func() {
		mctx.G().NotifyRouter.HandleTeambotEKNeeded(mctx.Ctx(), teamID, botUID, generation)
	}()

	ekLib := mctx.G().GetEKLib()
	if ekLib == nil {
		return fmt.Errorf("ekLib not found")
	}

	// Bot user needs the latest key
	if generation == 0 {
		// clear our caches here so we can force publish a key
		ekLib.PurgeTeamEKCachesForTeamID(mctx, teamID)
		ekLib.PurgeAllTeambotMetadataCaches(mctx)
		_, _, err = ekLib.GetOrCreateLatestTeambotEK(mctx, teamID, botUID.ToBytes())
		return err
	}

	// Bot needs a specific generation
	ekLib.PurgeTeamEKCachesForTeamIDAndGeneration(mctx, teamID, generation)
	ekLib.PurgeTeambotMetadataCache(mctx, teamID, botUID, generation)
	_, err = ekLib.GetTeambotEK(mctx, teamID, botUID.ToBytes(), generation, nil)
	return err
}
