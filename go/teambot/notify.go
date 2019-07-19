package teambot

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func NotifyTeambotEKNeeded(mctx libkb.MetaContext, teamID keybase1.TeamID, generation keybase1.EkGeneration) error {
	return notifyTeambotKeyNeeded(mctx, teamID, int(generation), true /* isEphemeral */)
}

func NotifyTeambotKeyNeeded(mctx libkb.MetaContext, teamID keybase1.TeamID, generation keybase1.TeambotKeyGeneration) error {
	return notifyTeambotKeyNeeded(mctx, teamID, int(generation), false /* isEphemeral */)
}

func notifyTeambotKeyNeeded(mctx libkb.MetaContext, teamID keybase1.TeamID, generation int, isEphemeral bool) (err error) {
	defer mctx.TraceTimed("notifyTeambotKeyNeeded", func() error { return err })()
	apiArg := libkb.APIArg{
		Endpoint:    "teambot/key_needed",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"team_id":      libkb.S{Val: string(teamID)},
			"generation":   libkb.U{Val: uint64(generation)},
			"is_ephemeral": libkb.B{Val: isEphemeral},
		},
	}
	_, err = mctx.G().GetAPI().Post(mctx, apiArg)
	return err
}

const teambotKeyWrongKIDDBVersion = 1
const MaxTeambotKeyWrongKIDPermitted = time.Hour * 24

func TeambotEKWrongKIDCacheKey(teamID keybase1.TeamID, botUID keybase1.UID,
	generation keybase1.EkGeneration) libkb.DbKey {
	return teambotKeyWrongKIDCacheKey(teamID, botUID, int(generation), true /* isEphemeral */)
}

func TeambotKeyWrongKIDCacheKey(teamID keybase1.TeamID, botUID keybase1.UID,
	generation keybase1.TeambotKeyGeneration) libkb.DbKey {
	return teambotKeyWrongKIDCacheKey(teamID, botUID, int(generation), false /* isEphemeral */)
}

func teambotKeyWrongKIDCacheKey(teamID keybase1.TeamID, botUID keybase1.UID,
	generation int, isEphemeral bool) libkb.DbKey {
	prefix := "TeambotKey"
	if isEphemeral {
		prefix = "TeambotEK"
	}
	key := fmt.Sprintf("%sWrongKID-%s-%s-%d-%d", prefix, teamID, botUID,
		generation, teambotKeyWrongKIDDBVersion)
	return libkb.DbKey{
		Typ: libkb.DBTeambotKeyWrongKID,
		Key: key,
	}
}

func TeambotEKWrongKIDPermitted(mctx libkb.MetaContext, teamID keybase1.TeamID,
	botUID keybase1.UID, generation keybase1.EkGeneration, now keybase1.Time) (bool, keybase1.Time, error) {
	return teambotKeyWrongKIDPermitted(mctx, teamID, botUID,
		int(generation), now, true /* isEphemeral */)
}

func TeambotKeyWrongKIDPermitted(mctx libkb.MetaContext, teamID keybase1.TeamID,
	botUID keybase1.UID, generation keybase1.TeambotKeyGeneration, now keybase1.Time) (bool, keybase1.Time, error) {
	return teambotKeyWrongKIDPermitted(mctx, teamID, botUID,
		int(generation), now, false /* isEphemeral */)
}

// teambotKeyWrongKIDPermitted checks if we can use a teambot key which is signed by
// an old PTK. Since bot members cannot create a new keys, we allow old
// signatures to be used for a short window, allowing a member to generate a
// new key signed by the latest PTK.
func teambotKeyWrongKIDPermitted(mctx libkb.MetaContext, teamID keybase1.TeamID,
	botUID keybase1.UID, generation int, now keybase1.Time, isEphemeral bool) (bool, keybase1.Time, error) {
	key := teambotKeyWrongKIDCacheKey(teamID, botUID, generation, isEphemeral)
	var ctime keybase1.Time
	found, err := mctx.G().GetKVStore().GetInto(&ctime, key)
	if err != nil {
		return false, 0, err
	}
	if !found {
		// Store when we first noticed wrongKID was set.
		err = mctx.G().GetKVStore().PutObj(key, nil, now)
		return true, 0, err
	}
	return now.Time().Sub(ctime.Time()) < MaxTeambotKeyWrongKIDPermitted, ctime, nil
}
