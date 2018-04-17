package storage

import (
	"bytes"
	"encoding/hex"
	"sync"
	"time"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/clockwork"
	"golang.org/x/net/context"
)

// MemEngine is an implementation of a gregor StateMachine that just keeps
// all incoming messages in a hash table, with one entry per user. It doesn't
// do anything fancy w/r/t indexing Items, so just iterates over all of them
// every time a dismissal or a state dump comes in. Used mainly for testing
// when SQLite isn't available.
type MemEngine struct {
	sync.Mutex
	objFactory gregor.ObjFactory
	clock      clockwork.Clock
	users      map[string](*user)
	log        logger.Logger
}

// NewMemEngine makes a new MemEngine with the given object factory and the
// potentially fake clock (or a real clock if not testing).
func NewMemEngine(f gregor.ObjFactory, cl clockwork.Clock, log logger.Logger) *MemEngine {
	return &MemEngine{
		objFactory: f,
		clock:      cl,
		users:      make(map[string](*user)),
		log:        log,
	}
}

var _ gregor.StateMachine = (*MemEngine)(nil)

// item is a wrapper around a Gregor item interface, with the ctime
// it arrived at, and the optional dtime at which it was dismissed. Note there's
// another Dtime internal to item that can be interpreted relative to the ctime
// of the wrapper object.
type item struct {
	item  gregor.Item
	ctime time.Time
	dtime *time.Time

	// If we received a message from the server that a message should be dismissed,
	// do so immediately, so as not to introduce clock-skew bugs. We previously
	// had a bug here --- a message would come in to dismiss a message M at server time T,
	// but then we would wait around for S seconds before marking that message as
	// dismissed, where S is the clock skew between the client and server. This seems
	// unnecessary, we should just mark the message dismissed when it comes in.
	dismissedImmediate bool
}

// loggedMsg is a message that we've logged on arrival into this state machine
// store. When it comes in, we stamp it with the current time, and also associate
// it with an item if there's one to speak of.
type loggedMsg struct {
	m     gregor.InBandMessage
	ctime time.Time
	i     *item
}

// user consists of a list of items (some of which might be dismissed) and
// and an unpruned log of all incoming messages.
type user struct {
	logger          logger.Logger
	items           [](*item)
	log             []loggedMsg
	localDismissals []gregor.MsgID
}

func newUser(logger logger.Logger) *user {
	return &user{
		logger: logger,
	}
}

// isDismissedAt returns true if item i is dismissed at time t. It will always return
// true if the `dismissedImmediate` flag was turned out.
func (i item) isDismissedAt(t time.Time) bool {
	if i.dismissedImmediate {
		return true
	}
	if i.dtime != nil && isBeforeOrSame(*i.dtime, t) {
		return true
	}
	if dt := i.item.DTime(); dt != nil && isBeforeOrSame(toTime(i.ctime, dt), t) {
		return true
	}
	return false
}

// isDismissedAt returns true if the log message has an associated item
// and that item was dismissed at time t.
func (m loggedMsg) isDismissedAt(t time.Time) bool {
	return m.i != nil && m.i.isDismissedAt(t)
}

// export the item i to a generic gregor.Item interface. Basically just return
// the object we got, but if there was no CTime() on the incoming message,
// then use the ctime we stamped on the message when it arrived.
func (i item) export(f gregor.ObjFactory) (gregor.Item, error) {
	md := i.item.Metadata()
	return f.MakeItem(md.UID(), md.MsgID(), md.DeviceID(), i.ctime, i.item.Category(), i.dtime, i.item.Body())
}

// addItem adds an item for this user
func (u *user) addItem(now time.Time, i gregor.Item) *item {
	msgID := i.Metadata().MsgID().Bytes()
	for _, it := range u.items {
		if bytes.Equal(msgID, it.item.Metadata().MsgID().Bytes()) {
			return it
		}
	}
	newItem := &item{item: i, ctime: nowIfZero(now, i.Metadata().CTime())}
	if i.DTime() != nil {
		newItem.dtime = i.DTime().Time()
	}
	u.items = append(u.items, newItem)
	return newItem
}

func (u *user) addItems(items []gregor.Item) {
	for _, it := range items {
		u.addItem(time.Now(), it)
	}
}

// logMessage logs a message for this user and potentially associates an item
func (u *user) logMessage(t time.Time, m gregor.InBandMessage, i *item) {
	for _, l := range u.log {
		if bytes.Equal(l.m.Metadata().MsgID().Bytes(), m.Metadata().MsgID().Bytes()) {
			return
		}
	}
	u.log = append(u.log, loggedMsg{m, t, i})
}

func (u *user) removeLocalDismissal(msgID gregor.MsgID) {
	var lds []gregor.MsgID
	for _, ld := range u.localDismissals {
		if ld.String() != msgID.String() {
			lds = append(lds, ld)
		}
	}
	u.localDismissals = lds
}

func msgIDtoString(m gregor.MsgID) string {
	return hex.EncodeToString(m.Bytes())
}

func (u *user) dismissMsgIDs(now time.Time, ids []gregor.MsgID) {
	set := make(map[string]bool)
	for _, i := range ids {
		set[msgIDtoString(i)] = true
	}
	for _, i := range u.items {
		if _, found := set[msgIDtoString(i.item.Metadata().MsgID())]; found {
			i.dtime = &now
			i.dismissedImmediate = true
			u.removeLocalDismissal(i.item.Metadata().MsgID())
		}
	}
}

func nowIfZero(now, t time.Time) time.Time {
	if t.IsZero() {
		return now
	}
	return t
}

func toTime(now time.Time, t gregor.TimeOrOffset) time.Time {
	if t == nil {
		return now
	}
	if t.Time() != nil {
		return *t.Time()
	}
	if t.Offset() != nil {
		return now.Add(*t.Offset())
	}
	return now
}

func (u *user) dismissRanges(now time.Time, rs []gregor.MsgRange) {
	for _, i := range u.items {
		for _, r := range rs {
			if r.Category().String() == i.item.Category().String() &&
				isBeforeOrSame(i.ctime, toTime(now, r.EndTime())) {
				i.dtime = &now
				i.dismissedImmediate = true
				u.removeLocalDismissal(i.item.Metadata().MsgID())
				break
			}
		}
	}
}

type timeOrOffset time.Time

func (t timeOrOffset) Time() *time.Time {
	ret := time.Time(t)
	return &ret
}
func (t timeOrOffset) Offset() *time.Duration { return nil }
func (t timeOrOffset) Before(t2 time.Time) bool {
	return time.Time(t).Before(t2)
}

var _ gregor.TimeOrOffset = timeOrOffset{}

func isBeforeOrSame(a, b time.Time) bool {
	return !b.Before(a)
}

func (u *user) state(now time.Time, f gregor.ObjFactory, d gregor.DeviceID, t gregor.TimeOrOffset) (gregor.State, error) {
	var items []gregor.Item
	table := make(map[string]gregor.Item)
	for _, i := range u.items {
		md := i.item.Metadata()
		did := md.DeviceID()
		if d != nil && did != nil && !bytes.Equal(did.Bytes(), d.Bytes()) {
			continue
		}
		if t != nil && toTime(now, t).Before(i.ctime) {
			continue
		}
		if i.isDismissedAt(toTime(now, t)) {
			continue
		}

		exported, err := i.export(f)
		if err != nil {
			return nil, err
		}
		items = append(items, exported)
		table[exported.Metadata().MsgID().String()] = exported
	}
	return f.MakeStateWithLookupTable(items, table)
}

func isMessageForDevice(m gregor.InBandMessage, d gregor.DeviceID) bool {
	sum := m.ToStateUpdateMessage()
	if sum == nil {
		return true
	}
	if d == nil {
		return true
	}
	did := sum.Metadata().DeviceID()
	if did == nil {
		return true
	}
	if bytes.Equal(did.Bytes(), d.Bytes()) {
		return true
	}
	return false
}

func (u *user) replayLog(now time.Time, d gregor.DeviceID, t time.Time) (msgs []gregor.InBandMessage, latestCTime *time.Time) {
	allmsgs := make(map[string]gregor.InBandMessage)
	for _, msg := range u.log {
		if latestCTime == nil || msg.ctime.After(*latestCTime) {
			latestCTime = &msg.ctime
		}
		if !isMessageForDevice(msg.m, d) {
			continue
		}
		if msg.ctime.Before(t) {
			continue
		}

		allmsgs[msg.m.Metadata().MsgID().String()] = msg.m
		if msg.isDismissedAt(now) {
			continue
		}

		msgs = append(msgs, msg.m)
	}
	msgs = FilterFutureDismissals(msgs, allmsgs, t)
	return
}

func (m *MemEngine) consumeInBandMessage(uid gregor.UID, msg gregor.InBandMessage) (time.Time, error) {
	user := m.getUser(uid)
	now := m.clock.Now()
	var i *item
	var err error
	switch {
	case msg.ToStateUpdateMessage() != nil:
		i, err = m.consumeStateUpdateMessage(user, now, msg.ToStateUpdateMessage())
	default:
	}

	retTime := now
	if i != nil {
		retTime = i.ctime
	}

	user.logMessage(retTime, msg, i)

	return retTime, err
}

func (m *MemEngine) ConsumeMessage(ctx context.Context, msg gregor.Message) (time.Time, error) {
	m.Lock()
	defer m.Unlock()

	switch {
	case msg.ToInBandMessage() != nil:
		return m.consumeInBandMessage(gregor.UIDFromMessage(msg), msg.ToInBandMessage())
	default:
		return m.clock.Now(), nil
	}
}

func (m *MemEngine) ConsumeLocalDismissal(ctx context.Context, u gregor.UID, msgID gregor.MsgID) error {
	user := m.getUser(u)
	user.removeLocalDismissal(msgID)
	user.localDismissals = append(user.localDismissals, msgID)
	return nil
}

func (m *MemEngine) InitLocalDismissals(ctx context.Context, u gregor.UID, msgIDs []gregor.MsgID) error {
	user := m.getUser(u)
	user.localDismissals = msgIDs
	return nil
}

func (m *MemEngine) LocalDismissals(ctx context.Context, u gregor.UID) (res []gregor.MsgID, err error) {
	user := m.getUser(u)
	return user.localDismissals, nil
}

func uidToString(u gregor.UID) string {
	return hex.EncodeToString(u.Bytes())
}

// getUser gets or makes a new user object for the given UID.
func (m *MemEngine) getUser(uid gregor.UID) *user {
	uidHex := uidToString(uid)
	if u, ok := m.users[uidHex]; ok {
		return u
	}
	u := newUser(m.log)
	m.users[uidHex] = u
	return u
}

func (m *MemEngine) consumeCreation(u *user, now time.Time, i gregor.Item) (*item, error) {
	newItem := u.addItem(now, i)
	return newItem, nil
}

func (m *MemEngine) consumeDismissal(u *user, now time.Time, d gregor.Dismissal, ctime time.Time) error {
	dtime := nowIfZero(now, ctime)
	if ids := d.MsgIDsToDismiss(); ids != nil {
		u.dismissMsgIDs(dtime, ids)
	}
	if r := d.RangesToDismiss(); r != nil {
		u.dismissRanges(dtime, r)
	}
	return nil
}

func (m *MemEngine) consumeStateUpdateMessage(u *user, now time.Time, msg gregor.StateUpdateMessage) (*item, error) {
	var err error
	var i *item
	if msg.Creation() != nil {
		if i, err = m.consumeCreation(u, now, msg.Creation()); err != nil {
			return nil, err
		}
	}
	if msg.Dismissal() != nil {
		md := msg.Metadata()
		if err = m.consumeDismissal(u, now, msg.Dismissal(), md.CTime()); err != nil {
			return nil, err
		}
	}
	return i, nil
}

func (m *MemEngine) State(ctx context.Context, u gregor.UID, d gregor.DeviceID, t gregor.TimeOrOffset) (gregor.State, error) {
	m.Lock()
	defer m.Unlock()
	user := m.getUser(u)
	return user.state(m.clock.Now(), m.objFactory, d, t)
}

func (m *MemEngine) StateByCategoryPrefix(ctx context.Context, u gregor.UID, d gregor.DeviceID, t gregor.TimeOrOffset, cp gregor.Category) (gregor.State, error) {
	state, err := m.State(ctx, u, d, t)
	if err != nil {
		return nil, err
	}
	items, err := state.ItemsWithCategoryPrefix(cp)
	if err != nil {
		return nil, err
	}
	return m.objFactory.MakeState(items)
}

func (m *MemEngine) Clear() error {
	m.users = make(map[string](*user))
	return nil
}

func (m *MemEngine) LatestCTime(ctx context.Context, u gregor.UID, d gregor.DeviceID) *time.Time {
	m.Lock()
	defer m.Unlock()
	log := m.getUser(u).log
	for i := len(log) - 1; i >= 0; i-- {
		if log[i].i != nil && log[i].i.item != nil &&
			(d == nil || log[i].i.item.Metadata() != nil &&
				(log[i].i.item.Metadata().DeviceID() == nil ||
					bytes.Equal(d.Bytes(),
						log[i].i.item.Metadata().DeviceID().Bytes()))) {
			return &log[i].ctime
		}
	}
	return nil
}

func (m *MemEngine) InBandMessagesSince(ctx context.Context, u gregor.UID, d gregor.DeviceID, t time.Time) ([]gregor.InBandMessage, error) {
	m.Lock()
	defer m.Unlock()
	msgs, _ := m.getUser(u).replayLog(m.clock.Now(), d, t)

	return msgs, nil
}

func (m *MemEngine) Reminders(ctx context.Context, maxReminders int) (gregor.ReminderSet, error) {
	// Unimplemented for MemEngine
	return nil, nil
}

func (m *MemEngine) DeleteReminder(ctx context.Context, r gregor.ReminderID) error {
	// Unimplemented for MemEngine
	return nil
}

func (m *MemEngine) IsEphemeral() bool {
	return true
}

func (m *MemEngine) InitState(s gregor.State) error {
	m.Lock()
	defer m.Unlock()

	items, err := s.Items()
	if err != nil {
		return err
	}

	now := m.clock.Now()
	for _, it := range items {
		user := m.getUser(it.Metadata().UID())
		ibm, err := m.objFactory.MakeInBandMessageFromItem(it)
		if err != nil {
			return err
		}

		item := user.addItem(now, it)
		user.logMessage(nowIfZero(now, item.ctime), ibm, item)
	}

	return nil
}

func (m *MemEngine) ObjFactory() gregor.ObjFactory {
	return m.objFactory
}

func (m *MemEngine) Clock() clockwork.Clock {
	return m.clock
}

func (m *MemEngine) ReminderLockDuration() time.Duration { return time.Minute }
