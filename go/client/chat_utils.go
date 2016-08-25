package client

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type uidUsernameMapper map[keybase1.UID]string

func (m uidUsernameMapper) getUsername(ctx context.Context, g *libkb.GlobalContext, uid keybase1.UID) (string, error) {
	if m == nil {
		m = make(uidUsernameMapper)
	}

	if username, ok := m[uid]; ok {
		return username, nil
	}

	userClient, err := GetUserClient(g)
	if err != nil {
		return "", err
	}
	var ret keybase1.User
	if ret, err = userClient.LoadUser(ctx, keybase1.LoadUserArg{
		Uid: uid,
	}); err != nil {
		return "", err
	}

	m[uid] = ret.Username
	return ret.Username, err
}
