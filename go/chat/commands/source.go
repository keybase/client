package commands

import (
	"context"
	"errors"
	"strings"

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

	builtin []types.ConversationCommand
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
	s.builtin = []types.ConversationCommand{
		NewDM(s.G()),
		NewHeadline(s.G()),
		NewHide(s.G()),
		NewJoin(s.G()),
		NewLeave(s.G()),
		NewMe(s.G()),
		NewMute(s.G()),
		NewShrug(s.G()),
		NewUnhide(s.G()),
	}
}

func (s *Source) GetBuiltins(ctx context.Context) (res chat1.ConversationCommandGroup) {
	res.Heading = "Keybase"
	for _, c := range s.builtin {
		res.Commands = append(res.Commands, c.Export())
	}
	return res
}

func (s *Source) ListCommands(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (res chat1.ConversationCommandGroups, err error) {
	defer s.Trace(ctx, func() error { return err }, "ListCommands")()
	return chat1.NewConversationCommandGroupsWithBuiltin(), nil
}

func (s *Source) AttemptBuiltinCommand(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName string, body chat1.MessageBody) (handled bool, err error) {
	defer s.Trace(ctx, func() error { return err }, "AttemptCommand")()
	if !body.IsType(chat1.MessageType_TEXT) {
		return false, nil
	}
	text := body.Text().Body
	if !strings.HasPrefix(text, "/") {
		return false, nil
	}
	for _, cmd := range s.builtin {
		if cmd.Match(ctx, text) {
			s.Debug(ctx, "AttemptCommand: matched command: %s, executing...", cmd.Name())
			return true, cmd.Execute(ctx, uid, convID, tlfName, text)
		}
	}
	return false, nil
}
