package client

import (
	"errors"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/protocol/keybase1"
)

func ParseOneTeamName(ctx *cli.Context) (string, error) {
	if len(ctx.Args()) == 0 {
		return "", errors.New("team name argument required")
	}
	if len(ctx.Args()) > 1 {
		return "", errors.New("one team name argument required, multiple found")
	}
	return ctx.Args()[0], nil
}

func ParseUser(ctx *cli.Context) (string, error) {
	username := ctx.String("user")
	if len(username) == 0 {
		return "", errors.New("username required via --user flag")
	}
	return username, nil
}

func ParseRole(ctx *cli.Context) (keybase1.TeamRole, error) {
	srole := ctx.String("role")
	if srole == "" {
		return 0, errors.New("team role required via --role flag")
	}

	role, ok := keybase1.TeamRoleMap[strings.ToUpper(srole)]
	if !ok {
		return 0, errors.New("invalid team role, please use owner, admin, writer, or reader")
	}

	return role, nil
}

func ParseUserAndRole(ctx *cli.Context) (string, keybase1.TeamRole, error) {
	username, err := ParseUser(ctx)
	if err != nil {
		return "", 0, err
	}
	role, err := ParseRole(ctx)
	if err != nil {
		return "", 0, err
	}
	return username, role, nil
}

func ParsePermanence(ctx *cli.Context) (bool, error) {
	permanence := ctx.String("permanence")
	if permanence != "true" && permanence != "false" {
		return false, errors.New("permanence required via --permanence flag, must be 'true' or 'false'")
	}
	return permanence == "true", nil
}
