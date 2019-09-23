package chat

import (
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
)

type UIInboxLoader struct {
	globals.Contextified
	utils.DebugLabeler
}

func NewUIInboxLoader(g *globals.Context) *UIInboxLoader {
	return &UIInboxLoader{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "UIInboxLoader", false),
	}
}
