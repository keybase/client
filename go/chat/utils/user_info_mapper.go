package utils

import (
	"fmt"
	"sync"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type uictxkey int

var uiKey uictxkey = 1

// UserInfoMapper looks up usernames and device names, memoizing the results.
// Only intended to be used for a single request (i.e., getting all the
// users and devices for a thread).
type UserInfoMapper struct {
	users       map[keybase1.UID]*libkb.User
	deviceNames map[string]string
	kbCtx       KeybaseContext
	sync.Mutex
}

func userInfoFromContext(ctx context.Context) (*UserInfoMapper, bool) {
	ui, ok := ctx.Value(uiKey).(*UserInfoMapper)
	return ui, ok
}

func GetUserInfoMapper(ctx context.Context, kbCtx KeybaseContext) (context.Context, *UserInfoMapper) {
	ui, ok := userInfoFromContext(ctx)
	if ok {
		return ctx, ui
	}
	ui = newUserInfoMapper(kbCtx)
	return context.WithValue(ctx, uiKey, ui), ui
}

func newUserInfoMapper(kbCtx KeybaseContext) *UserInfoMapper {
	return &UserInfoMapper{
		users:       make(map[keybase1.UID]*libkb.User),
		deviceNames: make(map[string]string),
		kbCtx:       kbCtx,
	}
}

func (u *UserInfoMapper) Lookup(uid keybase1.UID, deviceID keybase1.DeviceID) (username, deviceName string, err error) {
	user, err := u.User(uid)
	if err != nil {
		return "", "", err
	}

	u.Lock()
	defer u.Unlock()

	dkey := fmt.Sprintf("%s:%s", uid, deviceID)
	dname, ok := u.deviceNames[dkey]
	if !ok {
		d, err := user.GetDevice(deviceID)
		if err != nil {
			return "", "", err
		}
		if d.Description == nil {
			return "", "", fmt.Errorf("nil device name for %s", dkey)
		}
		dname = *d.Description
		u.deviceNames[dkey] = dname
	}

	return user.GetNormalizedName().String(), dname, nil
}

func (u *UserInfoMapper) UserFromCache(uid keybase1.UID) *libkb.User {
	u.Lock()
	defer u.Unlock()
	return u.users[uid]
}

func (u *UserInfoMapper) User(uid keybase1.UID) (*libkb.User, error) {
	u.Lock()
	defer u.Unlock()

	user, ok := u.users[uid]
	if !ok {
		u.kbCtx.GetLog().Debug("userInfoMapper: missed user cache: uid: %s", uid)
		var err error
		user, err = u.kbCtx.LoadUserByUID(uid)
		if err != nil {
			return nil, err
		}
		u.users[uid] = user
	}
	return user, nil
}
