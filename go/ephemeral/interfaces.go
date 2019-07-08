package ephemeral

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type EphemeralKeyer interface {
	Fetch(mctx libkb.MetaContext, teamID keybase1.TeamID, generation keybase1.EkGeneration, contentCtime *gregor1.Time) (keybase1.TeamEphemeralKeyBoxed, error)
	Unbox(mctx libkb.MetaContext, boxed keybase1.TeamEphemeralKeyBoxed, contentCtime *gregor1.Time) (keybase1.TeamEphemeralKey, error)
	Type() keybase1.TeamEphemeralKeyType
}
