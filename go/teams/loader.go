package teams

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type LoadTeamFreshness int

const (
	LoadTeamFreshnessRANCID LoadTeamFreshness = 0
	LoadTeamFreshnessAGED   LoadTeamFreshness = 1
	LoadTeamFreshnessFRESH  LoadTeamFreshness = 2
)

// Load a Team from the TeamLoader.
// Can be called from inside the teams package.
func Load(ctx context.Context, g *libkb.GlobalContext, lArg keybase1.LoadTeamArg) (*Team, error) {
	// teamData, err := g.GetTeamLoader().Load(ctx, lArg)
	// if err != nil {
	// 	return nil, err
	// }
	return nil, fmt.Errorf("TODO: implement team loader")
}

// Loader of keybase1.TeamData objects. Handles caching.
// Because there is one of this global object and it is attached to G,
// its Load interface must return a keybase1.TeamData not a teams.Team.
// To load a teams.Team use the package-level function Load.
// Threadsafe.
type TeamLoader struct {
	libkb.Contextified
	storage *Storage
	// Single-flight locks per team ID.
	locktab libkb.LockTable
}

func NewTeamLoader(g *libkb.GlobalContext, storage *Storage) *TeamLoader {
	return &TeamLoader{
		Contextified: libkb.NewContextified(g),
		storage:      storage,
	}
}

// NewTeamLoaderAndInstall creates a new loader and installs it into G.
func NewTeamLoaderAndInstall(g *libkb.GlobalContext) *TeamLoader {
	st := NewStorage(g)
	l := NewTeamLoader(g, st)
	g.SetTeamLoader(l)
	return l
}

func (l *TeamLoader) Load(ctx context.Context, lArg keybase1.LoadTeamArg) (res *keybase1.TeamData, err error) {
	me, err := l.getMe(ctx)
	if err != nil {
		return nil, err
	}
	return l.load(ctx, me, lArg)
}

func (l *TeamLoader) getMe(ctx context.Context) (res keybase1.UserVersion, err error) {
	return loadUserVersionByUID(ctx, l.G(), l.G().Env.GetUID())
}

func (l *TeamLoader) load(ctx context.Context, me keybase1.UserVersion, lArg keybase1.LoadTeamArg) (res *keybase1.TeamData, err error) {
	return nil, fmt.Errorf("TODO: implement team loader")
}

func (l *TeamLoader) OnLogout() {
	l.storage.onLogout()
}

func (l *TeamLoader) VerifyTeamName(ctx context.Context, id keybase1.TeamID, name keybase1.TeamName) error {
	l.G().Log.Warning("Using stubbed out VerifyTeamName - INSECURE -- please implement")
	return nil
}

func (l *TeamLoader) MapIDToName(ctx context.Context, id keybase1.TeamID) (keybase1.TeamName, error) {
	return keybase1.TeamName{}, nil
}
