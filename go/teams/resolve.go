package teams

import (
	"context"
	"fmt"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// ResolveIDToName takes a team ID and resolve it to a name. It can use server-assist
// but always cryptographically checks the result.
func ResolveIDToName(ctx context.Context, g *libkb.GlobalContext, id keybase1.TeamID) (name keybase1.TeamName, err error) {

	rres := g.Resolver.ResolveFullExpression(ctx, fmt.Sprintf("tid:%s", id))
	if err = rres.GetError(); err != nil {
		return keybase1.TeamName{}, err
	}
	name = rres.GetTeamName()
	err = g.GetTeamLoader().VerifyTeamName(ctx, id, name)
	if err != nil {
		return keybase1.TeamName{}, err
	}

	return name, nil
}

// ResolveNameToID takes a team name and resolve it to a team ID. It can use server-assist
// but always cryptographically checks the result.
func ResolveNameToID(ctx context.Context, g *libkb.GlobalContext, name keybase1.TeamName) (id keybase1.TeamID, err error) {
	rres := g.Resolver.ResolveFullExpression(ctx, fmt.Sprintf("team:%s", name))
	if err = rres.GetError(); err != nil {
		return keybase1.TeamID(""), err
	}
	id = rres.GetTeamID()

	err = g.GetTeamLoader().VerifyTeamName(ctx, id, name)
	if err != nil {
		return keybase1.TeamID(""), err
	}

	return id, nil
}
