package commands

import (
	"context"
	"errors"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

var ErrInvalidCommand = errors.New("invalid command")
var ErrInvalidArguments = errors.New("invalid arguments")

type Source struct {
	globals.Contextified
	utils.DebugLabeler

	builtin types.ConversationCommandGroup
}

func NewSource(g *globals.Context) *Source {
	s := &Source{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "Commands.Source", false),
	}
	s.makeBuiltin()
	return s
}

func (s *Source) makeBuiltin() {
	s.builtin = types.ConversationCommandGroup{
		Heading: "Keybase",
		Commands: []types.ConversationCommand{
			NewDM(s.G()),
			NewHide(s.G()),
			NewShrug(s.G()),
		},
	}
}

func (s *Source) ListCommands(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) ([]types.ConversationCommandGroup, error) {
	return []types.ConversationCommandGroup{s.builtin}, nil
}
