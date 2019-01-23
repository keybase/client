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
			NewHeadline(s.G()),
			NewHide(s.G()),
			NewJoin(s.G()),
			NewLeave(s.G()),
			NewMe(s.G()),
			NewMute(s.G()),
			NewShrug(s.G()),
			NewUnhide(s.G()),
		},
	}
}

func (s *Source) ListCommands(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (res []types.ConversationCommandGroup, err error) {
	defer s.Trace(ctx, func() error { return err }, "ListCommands")()
	return []types.ConversationCommandGroup{s.builtin}, nil
}

func (s *Source) AttemptCommand(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName string, body chat1.MessageBody) (handled bool, err error) {
	defer s.Trace(ctx, func() error { return err }, "AttemptCommand")()
	if !body.IsType(chat1.MessageType_TEXT) {
		return false, nil
	}
	text := body.Text().Body
	groups, err := s.ListCommands(ctx, uid, convID)
	if err != nil {
		return false, err
	}
	for _, g := range groups {
		if cmd, ok := g.Match(ctx, text); ok {
			s.Debug(ctx, "AttemptCommand: matched command: %s, executing...", cmd.Name())
			return true, cmd.Execute(ctx, uid, convID, tlfName, text)
		}
	}
	return false, nil
}
