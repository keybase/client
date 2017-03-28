package storage

import (
	"bytes"
	"errors"
	"fmt"
	"time"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/net/context"

	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type LocalStorageEngine interface {
	Store(gregor.UID, []byte) error
	Load(gregor.UID) ([]byte, error)
}

type Client struct {
	User    gregor.UID
	Device  gregor.DeviceID
	Sm      gregor.StateMachine
	Storage LocalStorageEngine
	Log     rpc.LogOutput

	SaveTimer <-chan time.Time
}

func NewClient(user gregor.UID, device gregor.DeviceID, sm gregor.StateMachine,
	storage LocalStorageEngine, saveInterval time.Duration, log rpc.LogOutput) *Client {
	c := &Client{
		User:      user,
		Device:    device,
		Sm:        sm,
		Storage:   storage,
		Log:       log,
		SaveTimer: time.Tick(saveInterval), // How often we save to local storage
	}
	return c
}

func (c *Client) Save() error {
	if !c.Sm.IsEphemeral() {
		return errors.New("state machine is non-ephemeral")
	}

	state, err := c.Sm.State(c.User, c.Device, nil)
	if err != nil {
		return err
	}

	b, err := state.Marshal()
	if err != nil {
		return err
	}

	return c.Storage.Store(c.User, b)
}

func (c *Client) Restore() error {
	if !c.Sm.IsEphemeral() {
		return errors.New("state machine is non-ephemeral")
	}

	value, err := c.Storage.Load(c.User)
	if err != nil {
		return fmt.Errorf("Restore(): failed to load: %s", err.Error())
	}

	state, err := c.Sm.ObjFactory().UnmarshalState(value)
	if err != nil {
		return fmt.Errorf("Restore(): failed to unmarshal: %s", err.Error())
	}

	if err := c.Sm.InitState(state); err != nil {
		return fmt.Errorf("Restore(): failed to init state: %s", err.Error())
	}

	return nil
}

type ErrHashMismatch struct{}

func (e ErrHashMismatch) Error() string {
	return "local state hash != server state hash"
}

func (c *Client) SyncFromTime(cli gregor1.IncomingInterface, t *time.Time) (msgs []gregor.InBandMessage, err error) {

	ctx, _ := context.WithTimeout(context.Background(), time.Second)
	arg := gregor1.SyncArg{
		Uid:      gregor1.UID(c.User.Bytes()),
		Deviceid: gregor1.DeviceID(c.Device.Bytes()),
	}
	if t != nil {
		arg.Ctime = gregor1.ToTime(*t)
	}

	// Grab the events from gregord
	c.Log.Debug("Sync(): start time: %s", gregor1.FromTime(arg.Ctime))
	res, err := cli.Sync(ctx, arg)
	if err != nil {
		return nil, err
	}

	c.Log.Debug("Sync(): consuming %d messages", len(res.Msgs))
	for _, ibm := range res.Msgs {
		m := gregor1.Message{Ibm_: &ibm}
		msgs = append(msgs, ibm)
		c.Sm.ConsumeMessage(m)
	}

	// Check to make sure the server state is legit
	state, err := c.Sm.State(c.User, c.Device, nil)
	if err != nil {
		return nil, err
	}
	hash, err := state.Hash()
	if err != nil {
		return nil, err
	}
	if !bytes.Equal(res.Hash, hash) {
		return nil, ErrHashMismatch{}
	}

	return msgs, nil
}

func (c *Client) freshSync(cli gregor1.IncomingInterface) ([]gregor.InBandMessage, error) {

	var msgs []gregor.InBandMessage
	var err error

	c.Sm.Clear()
	state, err := c.State(cli)
	if err != nil {
		return msgs, err
	}
	if msgs, err = c.InBandMessagesFromState(state); err != nil {
		return msgs, err
	}
	if err = c.Sm.InitState(state); err != nil {
		return msgs, err
	}

	return msgs, nil
}

func (c *Client) Sync(cli gregor1.IncomingInterface) (res []gregor.InBandMessage, err error) {
	defer func() {
		if err == nil {
			if err = c.Save(); err != nil {
				c.Log.Debug("Sync(): error save state: %s", err.Error())
			}
		}
	}()

	latestCtime := c.Sm.LatestCTime(c.User, c.Device)
	if latestCtime == nil || latestCtime.IsZero() {
		c.Log.Debug("Sync(): fresh server sync: using State()")
		return c.freshSync(cli)
	}

	c.Log.Debug("Sync(): incremental server sync: using Sync()")
	msgs, err := c.SyncFromTime(cli, latestCtime)
	if err != nil {
		if _, ok := err.(ErrHashMismatch); ok {
			c.Log.Debug("Sync(): hash check failure: %v", err)
			return c.freshSync(cli)
		}
		return msgs, err
	}
	c.Log.Debug("Sync(): sync success!")
	return msgs, nil
}

func (c *Client) InBandMessagesFromState(s gregor.State) ([]gregor.InBandMessage, error) {
	items, err := s.Items()
	if err != nil {
		return nil, err
	}

	var res []gregor.InBandMessage
	for _, i := range items {
		if ibm, err := c.Sm.ObjFactory().MakeInBandMessageFromItem(i); err == nil {
			res = append(res, ibm)
		}
	}
	return res, nil
}

func (c *Client) State(cli gregor1.IncomingInterface) (res gregor.State, err error) {
	ctx, _ := context.WithTimeout(context.Background(), 5*time.Second)
	arg := gregor1.StateArg{
		Uid:          gregor1.UID(c.User.Bytes()),
		Deviceid:     gregor1.DeviceID(c.Device.Bytes()),
		TimeOrOffset: gregor1.TimeOrOffset{},
	}
	res, err = cli.State(ctx, arg)
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (c *Client) StateMachineConsumeMessage(m gregor1.Message) error {
	if _, err := c.Sm.ConsumeMessage(m); err != nil {
		return err
	}

	// Check to see if we should save
	select {
	case <-c.SaveTimer:
		c.Log.Debug("StateMachineConsumeMessage(): saving local state")
		return c.Save()
	default:
		c.Log.Debug("StateMachineConsumeMessage(): not saving local state")
		// Plow through if the timer isn't up
	}

	return nil
}

func (c *Client) StateMachineLatestCTime() *time.Time {
	return c.Sm.LatestCTime(c.User, c.Device)
}

func (c *Client) StateMachineInBandMessagesSince(t time.Time) ([]gregor.InBandMessage, error) {
	return c.Sm.InBandMessagesSince(c.User, c.Device, t)
}

func (c *Client) StateMachineState(t gregor.TimeOrOffset) (gregor.State, error) {
	return c.Sm.State(c.User, c.Device, t)
}
