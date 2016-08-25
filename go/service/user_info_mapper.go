package service

import (
	"context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// UserInfoMapper looks for username and device name with given UIDs and
// DeviceIDs. This would be a frequent operation for chat, so we should cache
// lookup results.
//
// TODO: cache
type userInfoMapper struct {
	g *libkb.GlobalContext
}

func (m userInfoMapper) getUsername(ctx context.Context, uid keybase1.UID) (string, error) {
	arg := libkb.NewLoadUserByUIDArg(m.g, uid)
	arg.PublicKeyOptional = true
	u, err := libkb.LoadUser(arg)
	if err != nil {
		// TODO: populate this error when we have integration test
		return "getting username error", nil
	}
	return u.GetName(), nil
}

func (m userInfoMapper) getDeviceName(ctx context.Context, did keybase1.DeviceID) (string, error) {
	return "unimplemented", nil
}
