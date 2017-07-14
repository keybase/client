package libkb

import (
	"errors"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

type nullTeamLoader struct {
	Contextified
}

var _ TeamLoader = (*nullTeamLoader)(nil)

func newNullTeamLoader(g *GlobalContext) *nullTeamLoader {
	return &nullTeamLoader{NewContextified(g)}
}

// VerifyTeamName verifies that id corresponds to name and returns an error
// if it doesn't. Right now, it is a Noop (and therefore insecure) to get
// tests to pass. Once we have an actual implementation, we should change this
// to error out in all cases.
func (n nullTeamLoader) VerifyTeamName(ctx context.Context, id keybase1.TeamID, name keybase1.TeamName) error {
	n.G().Log.Warning("Using nullTeamLoader -- INSECURE -- please implement")
	return nil
}

// MapIDToName maps the team ID to the corresponding name, and can be serviced
// from the team cache. If no entry is available in the cache, it is OK to return
// an empty/nil TeamName, and callers are free to try again with a server access
// (this actually happens in the Resolver).
func (n nullTeamLoader) MapIDToName(ctx context.Context, id keybase1.TeamID) (keybase1.TeamName, error) {
	return keybase1.TeamName{}, nil
}

func (n nullTeamLoader) NotifyTeamRename(ctx context.Context, id keybase1.TeamID, newName string) error {
	return nil
}

func (n nullTeamLoader) Load(context.Context, keybase1.LoadTeamArg) (*keybase1.TeamData, error) {
	return nil, errors.New("unimplemented")
}

func (n nullTeamLoader) OnLogout() {}
