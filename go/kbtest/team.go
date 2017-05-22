package kbtest

import (
	"encoding/hex"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
)

func CreateTeam(g *libkb.GlobalContext) (string, error) {
	b, err := libkb.RandBytes(4)
	if err != nil {
		return "", err
	}
	name := hex.EncodeToString(b)
	eng := engine.NewTeamCreateEngine(g, name)
	ctx := &engine.Context{}
	if err := eng.Run(ctx); err != nil {
		return "", err
	}
	return name, nil
}
