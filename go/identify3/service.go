package identify3

import (
	"fmt"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func Identify3(mctx libkb.MetaContext, ui3 keybase1.Identify3UiInterface, arg keybase1.Identify3Arg) (err error) {
	ui1, err := NewUIAdapterMakeSession(mctx.BackgroundWithLogTags(), ui3, arg.GuiID)
	if err != nil {
		return err
	}
	i2arg := keybase1.Identify2Arg{
		UserAssertion:    string(arg.Assertion),
		ForceRemoteCheck: arg.IgnoreCache,
		ForceDisplay:     true,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_GUI_PROFILE,
		NoSkipSelf:       true,
	}
	mctx = mctx.WithIdentifyUI(ui1)
	eng := engine.NewResolveThenIdentify2(mctx.G(), &i2arg)
	err = engine.RunEngine2(mctx, eng)
	if err != nil {
		return err
	}

	return nil
}

type identify3Action int

const (
	identify3ActionFollow   identify3Action = 1
	identify3ActionUnfollow identify3Action = 2
	identify3ActionIgnore   identify3Action = 3
)

func FollowUser(mctx libkb.MetaContext, arg keybase1.Identify3FollowUserArg) (err error) {
	var action identify3Action
	if arg.Follow {
		action = identify3ActionFollow
	} else {
		action = identify3ActionUnfollow
	}
	return doAction(mctx, arg.GuiID, action)
}

func doAction(mctx libkb.MetaContext, guiID keybase1.Identify3GUIID, action identify3Action) error {

	sess, err := mctx.G().Identify3State.Get(guiID)
	if err != nil {
		return err
	}
	if sess == nil {
		return libkb.NewNotFoundError(fmt.Sprintf("session %s wasn't found", guiID))
	}

	sess.Lock()
	defer sess.Unlock()
	outcome := sess.OutcomeUnlocked()
	if outcome == nil {
		return libkb.NewNotFoundError(fmt.Sprintf("outcome for session %s wasn't ready; is there a race?", guiID))
	}

	switch action {
	case identify3ActionFollow, identify3ActionIgnore:
		err = doFollow(mctx, action, outcome)
	case identify3ActionUnfollow:
		err = doUnfollow(mctx, outcome)
	}
	if err == nil {
		mctx.G().Identify3State.Remove(guiID)
	}
	return err
}

func doUnfollow(mctx libkb.MetaContext, outcome *libkb.IdentifyOutcome) (err error) {
	sv := libkb.KeybaseSignatureV2
	uarg := engine.UntrackEngineArg{
		Username:   outcome.Username,
		SigVersion: sv,
	}
	eng := engine.NewUntrackEngine(mctx.G(), &uarg)
	return engine.RunEngine2(mctx, eng)
}

func doFollow(mctx libkb.MetaContext, action identify3Action, outcome *libkb.IdentifyOutcome) (err error) {
	sv := keybase1.SigVersion(2)
	ttarg := engine.TrackTokenArg{
		Options: keybase1.TrackOptions{
			SigVersion: &sv,
		},
		Outcome: outcome,
	}
	if action == identify3ActionIgnore {
		ttarg.Options.ExpiringLocal = true
	}
	eng := engine.NewTrackToken(mctx.G(), &ttarg)
	return engine.RunEngine2(mctx, eng)
}

func IgnoreUser(mctx libkb.MetaContext, guiID keybase1.Identify3GUIID) (err error) {
	return doAction(mctx, guiID, identify3ActionIgnore)
}
