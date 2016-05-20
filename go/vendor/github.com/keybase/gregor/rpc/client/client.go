package storage

import (
	"bytes"
	"errors"
	"time"

	"github.com/keybase/gregor"
	"github.com/keybase/gregor/protocol/gregor1"
	"golang.org/x/net/context"

	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type LocalStorageEngine interface {
	Store(gregor.UID, []byte) error
	Load(gregor.UID) ([]byte, error)
}

type Client struct {
	user    gregor.UID
	device  gregor.DeviceID
	sm      gregor.StateMachine
	storage LocalStorageEngine
	log     rpc.LogOutput

	saveTimer <-chan time.Time
}

func NewClient(user gregor.UID, device gregor.DeviceID, sm gregor.StateMachine,
	storage LocalStorageEngine, saveInterval time.Duration, log rpc.LogOutput) *Client {
	c := &Client{
		user:      user,
		device:    device,
		sm:        sm,
		storage:   storage,
		log:       log,
		saveTimer: time.Tick(saveInterval), // How often we save to local storage
	}
	return c
}

func (c *Client) Save() error {
	if !c.sm.IsEphemeral() {
		return errors.New("state machine is non-ephemeral")
	}

	state, err := c.sm.State(c.user, c.device, nil)
	if err != nil {
		return err
	}

	b, err := state.Marshal()
	if err != nil {
		return err
	}

	return c.storage.Store(c.user, b)
}

func (c *Client) Restore() error {
	if !c.sm.IsEphemeral() {
		return errors.New("state machine is non-ephemeral")
	}

	value, err := c.storage.Load(c.user)
	if err != nil {
		return err
	}

	state, err := c.sm.ObjFactory().UnmarshalState(value)
	if err != nil {
		return err
	}

	return c.sm.InitState(state)
}

type errHashMismatch struct{}

func (e errHashMismatch) Error() string {
	return "local state hash != server state hash"
}

func (c *Client) syncFromTime(cli gregor1.IncomingInterface, t *time.Time) error {
	ctx, _ := context.WithTimeout(context.Background(), time.Second)
	arg := gregor1.SyncArg{
		Uid:      gregor1.UID(c.user.Bytes()),
		Deviceid: gregor1.DeviceID(c.device.Bytes()),
	}
	if t != nil {
		arg.Ctime = gregor1.ToTime(*t)
	}

	// Grab the events from gregord
	c.log.Debug("syncFromTime from: %s", gregor1.FromTime(arg.Ctime))
	res, err := cli.Sync(ctx, arg)
	if err != nil {
		return err
	}

	c.log.Debug("syncFromTime consuming %d messages", len(res.Msgs))
	for _, ibm := range res.Msgs {
		m := gregor1.Message{Ibm_: &ibm}
		c.sm.ConsumeMessage(m)
	}

	// Check to make sure the server state is legit
	state, err := c.sm.State(c.user, c.device, nil)
	if err != nil {
		return err
	}
	hash, err := state.Hash()
	if err != nil {
		return err
	}
	if !bytes.Equal(res.Hash, hash) {
		return errHashMismatch{}
	}

	return nil
}

func (c *Client) Sync(cli gregor1.IncomingInterface) error {
	if err := c.syncFromTime(cli, c.sm.LatestCTime(c.user, c.device)); err != nil {
		if _, ok := err.(errHashMismatch); ok {
			c.log.Info("Sync failure: %v\nResetting StateMachine and retrying", err)
			c.sm.Clear()
			err = c.syncFromTime(cli, nil)
		}
		return err
	}
	return nil
}

func (c *Client) ConsumeMessage(m gregor1.Message) error {
	if _, err := c.sm.ConsumeMessage(m); err != nil {
		return err
	}

	// Check to see if we should save
	select {
	case <-c.saveTimer:
		return c.Save()
	default:
		// Plow through if the timer isn't up
	}

	return nil
}

func (c *Client) LatestCTime() *time.Time {
	return c.sm.LatestCTime(c.user, c.device)
}

func (c *Client) InBandMessagesSince(t time.Time) ([]gregor.InBandMessage, error) {
	return c.sm.InBandMessagesSince(c.user, c.device, t)
}
