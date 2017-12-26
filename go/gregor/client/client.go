package storage

import (
	"bytes"
	"errors"
	"fmt"
	"time"

	"github.com/keybase/client/go/logger"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/net/context"
)

type LocalStorageEngine interface {
	Store(gregor.UID, []byte, [][]byte) error
	Load(gregor.UID) ([]byte, [][]byte, error)
}

type Client struct {
	User    gregor.UID
	Device  gregor.DeviceID
	Sm      gregor.StateMachine
	Storage LocalStorageEngine
	Log     logger.Logger

	SaveTimer <-chan time.Time
}

func NewClient(user gregor.UID, device gregor.DeviceID, sm gregor.StateMachine,
	storage LocalStorageEngine, saveInterval time.Duration, log logger.Logger) *Client {
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

func (c *Client) Save(ctx context.Context) error {
	if !c.Sm.IsEphemeral() {
		return errors.New("state machine is non-ephemeral")
	}

	state, err := c.Sm.State(ctx, c.User, c.Device, nil)
	if err != nil {
		return err
	}

	b, err := state.Marshal()
	if err != nil {
		return err
	}

	localDismissals, err := c.Sm.LocalDismissals(ctx, c.User)
	if err != nil {
		return err
	}
	var ldm [][]byte
	for _, ld := range localDismissals {
		ldm = append(ldm, ld.Bytes())
	}
	return c.Storage.Store(c.User, b, ldm)
}

func (c *Client) Restore(ctx context.Context) error {
	if !c.Sm.IsEphemeral() {
		return errors.New("state machine is non-ephemeral")
	}

	value, ldm, err := c.Storage.Load(c.User)
	if err != nil {
		return fmt.Errorf("Restore(): failed to load: %s", err.Error())
	}

	state, err := c.Sm.ObjFactory().UnmarshalState(value)
	if err != nil {
		return fmt.Errorf("Restore(): failed to unmarshal: %s", err.Error())
	}

	var localDismissals []gregor.MsgID
	for _, ld := range ldm {
		msgID, err := c.Sm.ObjFactory().MakeMsgID(ld)
		if err != nil {
			return fmt.Errorf("Restore(): failed to unmarshal msgid: %s", err)
		}
		localDismissals = append(localDismissals, msgID)
	}

	if err := c.Sm.InitLocalDismissals(ctx, c.User, localDismissals); err != nil {
		return fmt.Errorf("Restore(): failed to init local dismissals: %s", err)
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

func (c *Client) SyncFromTime(ctx context.Context, cli gregor1.IncomingInterface, t *time.Time,
	syncResult *gregor1.SyncResult) (msgs []gregor.InBandMessage, err error) {

	ctx, _ = context.WithTimeout(ctx, time.Second)
	arg := gregor1.SyncArg{
		Uid:      gregor1.UID(c.User.Bytes()),
		Deviceid: gregor1.DeviceID(c.Device.Bytes()),
	}
	if t != nil {
		arg.Ctime = gregor1.ToTime(*t)
	}

	// Grab the events from gregord
	if syncResult == nil {
		c.Log.CDebugf(ctx, "Sync(): start time: %s", gregor1.FromTime(arg.Ctime))
		syncResult = new(gregor1.SyncResult)
		*syncResult, err = cli.Sync(ctx, arg)
		if err != nil {
			return nil, err
		}
	} else {
		c.Log.CDebugf(ctx, "Sync(): skipping sync call, data previously obtained")
	}

	c.Log.CDebugf(ctx, "Sync(): consuming %d messages", len(syncResult.Msgs))
	for _, ibm := range syncResult.Msgs {
		c.Log.CDebugf(ctx, "Sync(): consuming msgid: %s", ibm.Metadata().MsgID())
		m := gregor1.Message{Ibm_: &ibm}
		msgs = append(msgs, ibm)
		c.Sm.ConsumeMessage(ctx, m)
	}

	// Check to make sure the server state is legit
	state, err := c.Sm.State(ctx, c.User, c.Device, nil)
	if err != nil {
		return nil, err
	}
	items, err := state.Items()
	if err != nil {
		return nil, err
	}
	c.Log.CDebugf(ctx, "Sync(): state items: %d", len(items))
	for _, it := range items {
		c.Log.CDebugf(ctx, "Sync(): state item: %s", it.Metadata().MsgID())
	}
	hash, err := state.Hash()
	if err != nil {
		return nil, err
	}
	if !bytes.Equal(syncResult.Hash, hash) {
		return nil, ErrHashMismatch{}
	}

	return msgs, nil
}

func (c *Client) freshSync(ctx context.Context, cli gregor1.IncomingInterface, state *gregor.State) ([]gregor.InBandMessage, error) {

	var msgs []gregor.InBandMessage
	var err error

	c.Sm.Clear()
	if state == nil {
		state = new(gregor.State)
		*state, err = c.State(cli)
		if err != nil {
			return msgs, err
		}
	} else {
		c.Log.CDebugf(ctx, "Sync(): freshSync(): skipping State call, data previously obtained")
	}

	if msgs, err = c.InBandMessagesFromState(*state); err != nil {
		return msgs, err
	}
	if err = c.Sm.InitState(*state); err != nil {
		return msgs, err
	}

	return msgs, nil
}

func (c *Client) Sync(ctx context.Context, cli gregor1.IncomingInterface,
	syncRes *chat1.SyncAllNotificationRes) (res []gregor.InBandMessage, err error) {
	defer func() {
		if err == nil {
			c.Log.CDebugf(ctx, "Sync(): sync success!")
			if err = c.Save(ctx); err != nil {
				c.Log.CDebugf(ctx, "Sync(): error save state: %s", err.Error())
			}
		} else {
			c.Log.CDebugf(ctx, "Sync(): failure: %s", err)
		}
	}()

	var syncResult *gregor1.SyncResult
	if syncRes != nil {
		c.Log.CDebugf(ctx, "Sync(): using previously obtained data")
		typ, err := syncRes.Typ()
		if err != nil {
			return res, err
		}
		switch typ {
		case chat1.SyncAllNotificationType_STATE:
			c.Log.CDebugf(ctx, "Sync(): using previously obtained state result for freshSync")
			st := gregor.State(syncRes.State())
			return c.freshSync(ctx, cli, &st)
		case chat1.SyncAllNotificationType_INCREMENTAL:
			c.Log.CDebugf(ctx, "Sync(): using previously obtained incremental result")
			inc := syncRes.Incremental()
			syncResult = &inc
		}
	}

	c.Log.Debug("Sync(): incremental server sync: using Sync()")
	msgs, err := c.SyncFromTime(ctx, cli, c.Sm.LatestCTime(ctx, c.User, c.Device), syncResult)
	if err != nil {
		if _, ok := err.(ErrHashMismatch); ok {
			c.Log.Debug("Sync(): hash check failure: %v", err)
			return c.freshSync(ctx, cli, nil)
		}
		return msgs, err
	}
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

func (c *Client) StateMachineConsumeLocalDismissal(ctx context.Context, id gregor.MsgID) error {
	if err := c.Sm.ConsumeLocalDismissal(ctx, c.User, id); err != nil {
		return err
	}
	return c.Save(ctx)
}

func (c *Client) StateMachineConsumeMessage(ctx context.Context, m gregor1.Message) error {
	if _, err := c.Sm.ConsumeMessage(ctx, m); err != nil {
		return err
	}

	// Check to see if we should save
	select {
	case <-c.SaveTimer:
		c.Log.CDebugf(ctx, "StateMachineConsumeMessage(): saving local state")
		return c.Save(ctx)
	default:
		c.Log.CDebugf(ctx, "StateMachineConsumeMessage(): not saving local state")
		// Plow through if the timer isn't up
	}

	return nil
}

func (c *Client) StateMachineLatestCTime(ctx context.Context) *time.Time {
	return c.Sm.LatestCTime(ctx, c.User, c.Device)
}

func (c *Client) StateMachineInBandMessagesSince(ctx context.Context, t time.Time, filterLocalDismissals bool) ([]gregor.InBandMessage, error) {
	ibms, err := c.Sm.InBandMessagesSince(ctx, c.User, c.Device, t)
	if err != nil {
		return nil, err
	}
	if filterLocalDismissals {
		ldmap, err := c.localDismissalMap(ctx)
		if err != nil {
			c.Log.CDebugf(ctx, "filterLocalDismissals: failed to get local dismissal map: %s", err)
			return ibms, nil
		}
		var filteredIbms []gregor.InBandMessage
		for _, ibm := range ibms {
			if !ldmap[ibm.Metadata().MsgID().String()] {
				filteredIbms = append(filteredIbms, ibm)
			} else {
				c.Log.CDebugf(ctx, "filterLocalDismissals: filtered message: %s", ibm.Metadata().MsgID())
			}
		}
		return filteredIbms, nil
	}
	return ibms, nil
}

func (c *Client) localDismissalMap(ctx context.Context) (map[string]bool, error) {
	lds, err := c.Sm.LocalDismissals(ctx, c.User)
	if err != nil {
		return nil, err
	}
	ldmap := make(map[string]bool)
	for _, ld := range lds {
		ldmap[ld.String()] = true
	}
	return ldmap, nil
}

func (c *Client) filterLocalDismissals(ctx context.Context, state gregor.State) gregor.State {
	ldmap, err := c.localDismissalMap(ctx)
	if err != nil {
		c.Log.CDebugf(ctx, "filterLocalDismissals: failed to read local dismissals, just returning state: %s",
			err)
	}
	items, err := state.Items()
	if err != nil {
		c.Log.CDebugf(ctx, "filterLocalDismissals: failed to get state items: %s", err)
		return state
	}
	var filteredItems []gregor.Item
	for _, it := range items {
		if !ldmap[it.Metadata().MsgID().String()] {
			filteredItems = append(filteredItems, it)
		} else {
			c.Log.CDebugf(ctx, "filterLocalDismissals: filtered state item: %s", it.Metadata().MsgID())
		}
	}
	filteredState, err := c.Sm.ObjFactory().MakeState(filteredItems)
	if err != nil {
		c.Log.CDebugf(ctx, "filterLocalDismissals: failed to make state: %s", err)
	}
	return filteredState
}

func (c *Client) StateMachineState(ctx context.Context, t gregor.TimeOrOffset, filterLocalDismissals bool) (gregor.State, error) {
	st, err := c.Sm.State(ctx, c.User, c.Device, t)
	if err != nil {
		return st, err
	}
	if filterLocalDismissals {
		return c.filterLocalDismissals(ctx, st), nil
	}
	return st, nil
}
