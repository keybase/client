package auth

import (
	libkb "github.com/keybase/client/go/libkb"
	logger "github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
	"time"
)

const (
	pollWait = 5 * time.Second
)

type pubsubMessageInner struct {
	UID keybase1.UID `json:"uid"`
}

type pubsubMessageOuter struct {
	SyncStamp int                `json:"sync_stamp"`
	Message   pubsubMessageInner `json:"message"`
}

type serverState struct {
	InstanceID      string `json:"instance_id"`
	LatestSyncStamp int    `json:"latest_sync_stamp"`
}

type pubsubResponse struct {
	Status      libkb.AppStatus      `json:"status"`
	ServerState serverState          `json:"server_state"`
	Messages    []pubsubMessageOuter `json:"messages"`
}

func (p *pubsubResponse) GetAppStatus() *libkb.AppStatus {
	return &p.Status
}

var _ UserKeyAPIer = (*userKeyAPI)(nil)

type userKeysResPublicKeys struct {
	Sibkeys []keybase1.KID `json:"sibkeys"`
	Subkeys []keybase1.KID `json:"subkeys"`
}

type userKeyRes struct {
	Status     libkb.AppStatus       `json:"status"`
	Username   string                `json:"username"`
	PublicKeys userKeysResPublicKeys `json:"public_keys"`
}

func (k *userKeyRes) GetAppStatus() *libkb.AppStatus {
	return &k.Status
}

type userKeyAPI struct {
	log           logger.Logger
	api           libkb.API
	lastSyncPoint int
	instanceID    string
}

func (u *userKeyAPI) GetUser(ctx context.Context, uid keybase1.UID) (
	un libkb.NormalizedUsername, sibkeys, subkeys []keybase1.KID, err error) {
	u.log.Debug("+ GetUser")
	defer func() {
		u.log.Debug("- GetUser -> %v", err)
	}()
	var ukr userKeyRes
	err = u.api.GetDecode(libkb.APIArg{
		Endpoint: "user/keys",
		Args: libkb.HTTPArgs{
			"uid": libkb.S{Val: uid.String()},
		},
	}, &ukr)
	if err != nil {
		return "", nil, nil, err
	}
	un = libkb.NewNormalizedUsername(ukr.Username)
	return un, ukr.PublicKeys.Sibkeys, ukr.PublicKeys.Subkeys, nil
}

func (u *userKeyAPI) PollForChanges(ctx context.Context) (uids []keybase1.UID, err error) {
	defer func() {
		if err != nil {
			u.log.Debug("- poll -> %v", err)
		}
	}()

	select {
	case <-ctx.Done():
		return nil, ErrCanceled
	case <-time.After(pollWait):
	}

	var psb pubsubResponse
	args := libkb.HTTPArgs{
		"feed":            libkb.S{Val: "user.key_change"},
		"last_sync_stamp": libkb.I{Val: u.lastSyncPoint},
		"instance_id":     libkb.S{Val: u.instanceID},
	}
	err = u.api.GetDecode(libkb.APIArg{
		Endpoint: "pubsub/poll",
		Args:     args,
	}, &psb)

	if err != nil {
		return uids, err
	}

	for _, message := range psb.Messages {
		uids = append(uids, message.Message.UID)
	}
	u.lastSyncPoint = psb.ServerState.LatestSyncStamp
	u.instanceID = psb.ServerState.InstanceID

	return uids, err
}

// NewUserKeyAPIer returns a UserKeyAPIer implementation.
func NewUserKeyAPIer(log logger.Logger, api libkb.API) UserKeyAPIer {
	return &userKeyAPI{log: log, api: api}
}
