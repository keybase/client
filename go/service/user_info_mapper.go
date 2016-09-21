package service

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// userInfoMapper looks up usernames and device names, memoizing the results.
// Only intended to be used for a single request (i.e., getting all the
// users and devices for a thread).
type userInfoMapper struct {
	users       map[keybase1.UID]*libkb.User
	deviceNames map[string]string
	libkb.Contextified
}

func newUserInfoMapper(g *libkb.GlobalContext) *userInfoMapper {
	return &userInfoMapper{
		users:        make(map[keybase1.UID]*libkb.User),
		deviceNames:  make(map[string]string),
		Contextified: libkb.NewContextified(g),
	}
}

func (u *userInfoMapper) lookup(uid keybase1.UID, deviceID keybase1.DeviceID) (username, deviceName string, err error) {
	user, ok := u.users[uid]
	if !ok {
		arg := libkb.NewLoadUserByUIDArg(u.G(), uid)
		arg.PublicKeyOptional = true
		var err error
		user, err = libkb.LoadUser(arg)
		if err != nil {
			return "", "", err
		}
		u.users[uid] = user
	}

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
