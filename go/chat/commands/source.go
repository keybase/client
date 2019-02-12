package commands

import (
	"context"
	"errors"
	"sort"
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

	builtins map[chat1.ConversationBuiltinCommandTyp][]types.ConversationCommand
}

func NewSource(g *globals.Context) *Source {
	s := &Source{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "Commands.Source", false),
	}
	s.makeBuiltins()
	return s
}

const (
	cmdCollapse int = iota
	cmdExpand
	cmdHeadline
	cmdHide
	cmdJoin
	cmdLeave
	cmdMe
	cmdMsg
	cmdMute
	cmdShrug
	cmdUnhide
)

func (s *Source) allCommands() (res map[int]types.ConversationCommand) {
	res = make(map[int]types.ConversationCommand)
	res[cmdCollapse] = NewCollapse(s.G())
	res[cmdExpand] = NewExpand(s.G())
	res[cmdHeadline] = NewHeadline(s.G())
	res[cmdHide] = NewHide(s.G())
	res[cmdJoin] = NewJoin(s.G())
	res[cmdLeave] = NewLeave(s.G())
	res[cmdMe] = NewMe(s.G())
	res[cmdMsg] = NewMsg(s.G())
	res[cmdMute] = NewMute(s.G())
	res[cmdShrug] = NewShrug(s.G())
	res[cmdUnhide] = NewUnhide(s.G())
	return res
}

func (s *Source) makeBuiltins() {
	cmds := s.allCommands()
	common := []types.ConversationCommand{
		cmds[cmdCollapse],
		cmds[cmdExpand],
		cmds[cmdHide],
		cmds[cmdMe],
		cmds[cmdMsg],
		cmds[cmdMute],
		cmds[cmdShrug],
		cmds[cmdUnhide],
	}
	s.builtins = make(map[chat1.ConversationBuiltinCommandTyp][]types.ConversationCommand)
	s.builtins[chat1.ConversationBuiltinCommandTyp_ADHOC] = common
	s.builtins[chat1.ConversationBuiltinCommandTyp_BIGTEAM] = append([]types.ConversationCommand{
		cmds[cmdHeadline],
		cmds[cmdJoin],
		cmds[cmdLeave],
	}, common...)
	s.builtins[chat1.ConversationBuiltinCommandTyp_BIGTEAMGENERAL] = append([]types.ConversationCommand{
		cmds[cmdHeadline],
		cmds[cmdJoin],
	}, common...)
	s.builtins[chat1.ConversationBuiltinCommandTyp_SMALLTEAM] = append([]types.ConversationCommand{
		cmds[cmdJoin],
	}, common...)
	for _, cmds := range s.builtins {
		sort.Slice(cmds, func(i, j int) bool {
			return cmds[i].Name() < cmds[j].Name()
		})
	}
}

func (s *Source) GetBuiltins(ctx context.Context) (res []chat1.BuiltinCommandGroup) {
	for typ, cmds := range s.builtins {
		var exportCmds []chat1.ConversationCommand
		for _, cmd := range cmds {
			exportCmds = append(exportCmds, cmd.Export())
		}
		res = append(res, chat1.BuiltinCommandGroup{
			Typ:      typ,
			Commands: exportCmds,
		})
	}
	sort.Slice(res, func(i, j int) bool {
		return res[i].Typ < res[j].Typ
	})
	return res
}

func (s *Source) GetBuiltinCommandType(ctx context.Context, c types.ConversationCommandsSpec) chat1.ConversationBuiltinCommandTyp {
	switch c.GetMembersType() {
	case chat1.ConversationMembersType_TEAM:
		switch c.GetTeamType() {
		case chat1.TeamType_COMPLEX:
			if c.GetTopicName() == globals.DefaultTeamTopic {
				return chat1.ConversationBuiltinCommandTyp_BIGTEAMGENERAL
			}
			return chat1.ConversationBuiltinCommandTyp_BIGTEAM
		default:
			return chat1.ConversationBuiltinCommandTyp_SMALLTEAM
		}
	default:
		return chat1.ConversationBuiltinCommandTyp_ADHOC
	}
}

func (s *Source) ListCommands(ctx context.Context, uid gregor1.UID, conv types.ConversationCommandsSpec) (res chat1.ConversationCommandGroups, err error) {
	defer s.Trace(ctx, func() error { return err }, "ListCommands")()
	return chat1.NewConversationCommandGroupsWithBuiltin(s.GetBuiltinCommandType(ctx, conv)), nil
}

func (s *Source) AttemptBuiltinCommand(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName string, body chat1.MessageBody) (handled bool, err error) {
	defer s.Trace(ctx, func() error { return err }, "AttemptBuiltinCommand")()
	if !body.IsType(chat1.MessageType_TEXT) {
		return false, nil
	}
	text := body.Text().Body
	if !strings.HasPrefix(text, "/") {
		return false, nil
	}
	ib, err := s.G().InboxSource.ReadUnverified(ctx, uid, types.InboxSourceDataSourceAll,
		&chat1.GetInboxQuery{
			ConvID: &convID,
		}, nil)
	if err != nil {
		return false, err
	}
	if len(ib.ConvsUnverified) == 0 {
		return false, errors.New("conv not found")
	}
	typ := s.GetBuiltinCommandType(ctx, ib.ConvsUnverified[0])
	for _, cmd := range s.builtins[typ] {
		if cmd.Match(ctx, text) {
			s.Debug(ctx, "AttemptBuiltinCommand: matched command: %s, executing...", cmd.Name())
			return true, cmd.Execute(ctx, uid, convID, tlfName, text)
		}
	}
	return false, nil
}
