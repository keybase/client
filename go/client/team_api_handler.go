package client

import (
	"encoding/json"
	"errors"
	"io"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type teamAPIHandler struct {
	libkb.Contextified
	cli    keybase1.TeamsClient
	indent bool
}

func newTeamAPIHandler(g *libkb.GlobalContext, indentOutput bool) *teamAPIHandler {
	return &teamAPIHandler{Contextified: libkb.NewContextified(g), indent: indentOutput}
}

func (t *teamAPIHandler) handle(ctx context.Context, c Call, w io.Writer) error {
	switch c.Params.Version {
	case 0, 1:
		return t.handleV1(ctx, c, w)
	default:
		return ErrInvalidVersion{version: c.Params.Version}
	}
}

func (t *teamAPIHandler) handleV1(ctx context.Context, c Call, w io.Writer) error {
	if err := t.requireOptions(c); err != nil {
		return err
	}

	cli, err := GetTeamsClient(t.G())
	if err != nil {
		return err
	}
	t.cli = cli

	switch c.Method {
	case "create":
		return t.createTeam(ctx, c, w)
	case "add-member":
		return t.addMember(ctx, c, w)
	case "remove-member":
		return t.removeMember(ctx, c, w)
	case "edit-member":
		return t.editMember(ctx, c, w)
	case "list-team-memberships":
		return t.listTeamMemberships(ctx, c, w)
	case "list-user-memberships":
		return t.listUserMemberships(ctx, c, w)
	case "list-self-memberships":
		return t.listSelfMemberships(ctx, c, w)
	case "rename":
		return t.renameSubteam(ctx, c, w)
	case "leave":
		return t.leaveTeam(ctx, c, w)
	case "delete":
		return t.deleteTeam(ctx, c, w)
	default:
		return ErrInvalidMethod{name: c.Method, version: 1}
	}
}

func (t *teamAPIHandler) createTeam(ctx context.Context, c Call, w io.Writer) error {
	/*
		var opts listOptionsV1
		// Options are optional for list
		if len(c.Params.Options) != 0 {
			if err := json.Unmarshal(c.Params.Options, &opts); err != nil {
				return err
			}
		}
		if err := opts.Check(); err != nil {
			return err
		}

		// opts are valid for list v1

		return a.encodeReply(c, a.svcHandler.ListV1(ctx, opts), w)
	*/
	return nil
}

func (t *teamAPIHandler) addMember(ctx context.Context, c Call, w io.Writer) error {
	return nil
}

func (t *teamAPIHandler) removeMember(ctx context.Context, c Call, w io.Writer) error {
	return nil
}

func (t *teamAPIHandler) editMember(ctx context.Context, c Call, w io.Writer) error {
	return nil
}

type listTeamOptions struct {
	Team            string `json:"team"`
	IncludeSubteams bool   `json:"include-subteams"`
	ForcePoll       bool   `json:"force-poll"`
}

func (t *teamAPIHandler) listTeamMemberships(ctx context.Context, c Call, w io.Writer) error {
	return nil
}

type listUserOptions struct {
	UserAssertion string `json:"user"`
}

func (t *teamAPIHandler) listUserMemberships(ctx context.Context, c Call, w io.Writer) error {
	return nil
}

func (t *teamAPIHandler) listSelfMemberships(ctx context.Context, c Call, w io.Writer) error {
	arg := keybase1.TeamListArg{
		All: true,
	}
	list, err := t.cli.TeamList(ctx, arg)
	if err != nil {
		return t.encodeErr(c, err, w)
	}
	return t.encodeResult(c, list, w)
}

func (t *teamAPIHandler) renameSubteam(ctx context.Context, c Call, w io.Writer) error {
	return nil
}

func (t *teamAPIHandler) leaveTeam(ctx context.Context, c Call, w io.Writer) error {
	return nil
}

func (t *teamAPIHandler) deleteTeam(ctx context.Context, c Call, w io.Writer) error {
	return nil
}

func (t *teamAPIHandler) requireOptions(c Call) error {
	if len(c.Params.Options) == 0 {
		if c.Method != "list-self-memberships" {
			return ErrInvalidOptions{version: 1, method: c.Method, err: errors.New("empty options")}
		}
	}
	return nil

}

func (t *teamAPIHandler) encodeResult(call Call, result interface{}, w io.Writer) error {
	reply := Reply{
		Result: result,
	}
	return t.encodeReply(call, reply, w)
}

func (t *teamAPIHandler) encodeErr(call Call, err error, w io.Writer) error {
	reply := Reply{Error: &CallError{Message: err.Error()}}
	return t.encodeReply(call, reply, w)
}

func (t *teamAPIHandler) encodeReply(call Call, reply Reply, w io.Writer) error {
	reply.Jsonrpc = call.Jsonrpc
	reply.ID = call.ID

	enc := json.NewEncoder(w)
	if t.indent {
		enc.SetIndent("", "    ")
	}
	return enc.Encode(reply)
}
