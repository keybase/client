package gregor

import (
	"net"
	"time"

	"github.com/keybase/clockwork"
	"golang.org/x/net/context"
)

type InBandMsgType int

const (
	InBandMsgTypeNone   InBandMsgType = 0
	InBandMsgTypeUpdate InBandMsgType = 1
	InBandMsgTypeSync   InBandMsgType = 2
)

type UID interface {
	Bytes() []byte
	String() string
}

type MsgID interface {
	Bytes() []byte
	String() string
}

type DeviceID interface {
	Bytes() []byte
	String() string
}

type System interface {
	String() string
}

type Category interface {
	String() string
}

type Body interface {
	Bytes() []byte
}

type Metadata interface {
	UID() UID
	MsgID() MsgID
	CTime() time.Time
	DeviceID() DeviceID
	InBandMsgType() InBandMsgType
}

type MessageWithMetadata interface {
	Metadata() Metadata
}

type InBandMessage interface {
	MessageWithMetadata
	ToStateUpdateMessage() StateUpdateMessage
	ToStateSyncMessage() StateSyncMessage
	Merge(m1 InBandMessage) (InBandMessage, error)
}

type StateUpdateMessage interface {
	MessageWithMetadata
	Creation() Item
	Dismissal() Dismissal
}

type StateSyncMessage interface {
	MessageWithMetadata
}

type OutOfBandMessage interface {
	System() System
	UID() UID
	Body() Body
}

type TimeOrOffset interface {
	Time() *time.Time
	Offset() *time.Duration
	Before(t time.Time) bool
	IsZero() bool
}

type Item interface {
	MessageWithMetadata
	DTime() TimeOrOffset
	RemindTimes() []TimeOrOffset
	Body() Body
	Category() Category
}

type Reminder interface {
	Item() Item
	RemindTime() time.Time
	Seqno() int
}

type MsgRange interface {
	EndTime() TimeOrOffset
	Category() Category
	SkipMsgIDs() []MsgID
}

type Dismissal interface {
	MsgIDsToDismiss() []MsgID
	RangesToDismiss() []MsgRange
}

type State interface {
	Items() ([]Item, error)
	GetItem(msgID MsgID) (Item, bool)
	ItemsInCategory(c Category) ([]Item, error)
	ItemsWithCategoryPrefix(c Category) ([]Item, error)
	Marshal() ([]byte, error)
	Hash() ([]byte, error)
	Export() (ProtocolState, error)
}

type ProtocolState interface {
	State
	ProtocolName() string
}

type Message interface {
	ToInBandMessage() InBandMessage
	ToOutOfBandMessage() OutOfBandMessage
	Marshal() ([]byte, error)
}

type ReminderSet interface {
	Reminders() []Reminder
	MoreRemindersReady() bool
}

type ReminderID interface {
	MsgID() MsgID
	UID() UID
	Seqno() int
}

// MessageConsumer consumes state update messages. It's half of
// the state machine protocol
type MessageConsumer interface {
	// ConsumeMessage is called on a new incoming message to mutate the state
	// of the state machine. Of course messages can be "inband" which actually
	// perform state mutations, or might be "out-of-band" that just use the
	// Gregor broadcast mechanism to make sure that all clients get the
	// notification. It returns a version of the message to broadcast to clients.
	ConsumeMessage(ctx context.Context, m Message) (Message, error)
}

// StateMachine is the central interface of the Gregor system. Various parts of the
// server and client infrastructure will implement various parts of this interface,
// to ensure that the state machine can be replicated, and that it can be queried.
type StateMachine interface {
	MessageConsumer

	// State returns the state for the user u on device d at time t.
	// d can be nil, in which case the global state (across all devices)
	// is returned. If t is nil, then use Now, otherwise, return the state
	// at the given time.
	State(ctx context.Context, u UID, d DeviceID, t TimeOrOffset) (State, error)

	// StateByCategoryPrefix returns the IBMs in the given state that match
	// the given category prefix. It's similar to calling State().ItemsInCategory()
	// but results in less data transfer.
	StateByCategoryPrefix(ctx context.Context, u UID, d DeviceID, t TimeOrOffset, cp Category) (State, error)

	// IsEphemeral returns whether the backend storage needs to be saved/restored.
	IsEphemeral() bool

	// InitState iterates through the given State's Items, setting the
	// StateMachine's storage. Note: This should only be called to
	// initialize an ephemeral StateMachine.
	InitState(s State) error

	// LatestCTime returns the CTime of the newest item for the given user & device.
	LatestCTime(ctx context.Context, u UID, d DeviceID) *time.Time

	// Clear removes all existing state from the StateMachine.
	Clear() error

	// InBandMessagesSince returns all messages since the given time
	// for the user u on device d.  If d is nil, then we'll return
	// all messages across all devices.  If d is a device, then we'll
	// return global messages and per-device messages for that device.
	InBandMessagesSince(ctx context.Context, u UID, d DeviceID, t time.Time) ([]InBandMessage, error)

	// Reminders returns a slice of non-dismissed items past their RemindTimes.
	Reminders(ctx context.Context, maxReminders int) (ReminderSet, error)

	// DeleteReminder deletes a reminder so it won't be in the queue any longer.
	DeleteReminder(ctx context.Context, r ReminderID) error

	// ObjFactory returns the ObjFactory used by this StateMachine.
	ObjFactory() ObjFactory

	// Clock returns the clockwork.Clock used by this StateMachine.
	Clock() clockwork.Clock

	// How long we lock access to reminders; after this time, it's open to other
	// consumers.
	ReminderLockDuration() time.Duration

	// Local dismissals for the device this state machine runs on
	LocalDismissals(context.Context, UID) ([]MsgID, error)

	// Set local dismissals on the state machine storage to the given list
	InitLocalDismissals(context.Context, UID, []MsgID) error

	// Consume a local dismissal in state machine storage
	ConsumeLocalDismissal(context.Context, UID, MsgID) error

	// Outbox gives all of the pending messages in the outbox
	Outbox(context.Context, UID) ([]Message, error)
	RemoveFromOutbox(context.Context, UID, MsgID) error

	// InitOutbox initializes a users outbox with the given messages
	InitOutbox(context.Context, UID, []Message) error

	// ConsumeOutboxMessage add a message to the outbox
	ConsumeOutboxMessage(context.Context, UID, Message) error
}

type ObjFactory interface {
	MakeUID(b []byte) (UID, error)
	MakeMsgID(b []byte) (MsgID, error)
	MakeDeviceID(b []byte) (DeviceID, error)
	MakeBody(b []byte) (Body, error)
	MakeCategory(s string) (Category, error)
	MakeItem(u UID, msgid MsgID, deviceid DeviceID, ctime time.Time, c Category, dtime *time.Time, body Body) (Item, error)
	MakeReminder(i Item, seqno int, t time.Time) (Reminder, error)
	MakeReminderID(u UID, msgid MsgID, seqno int) (ReminderID, error)
	MakeDismissalByRange(uid UID, msgid MsgID, devid DeviceID, ctime time.Time, c Category, d time.Time,
		skipMsgIDs []MsgID) (InBandMessage, error)
	MakeDismissalByIDs(uid UID, msgid MsgID, devid DeviceID, ctime time.Time, d []MsgID) (InBandMessage, error)
	MakeStateSyncMessage(uid UID, msgid MsgID, devid DeviceID, ctime time.Time) (InBandMessage, error)
	MakeState(i []Item) (State, error)
	MakeStateWithLookupTable(i []Item, table map[string]Item) (State, error)
	MakeMetadata(uid UID, msgid MsgID, devid DeviceID, ctime time.Time, i InBandMsgType) (Metadata, error)
	MakeInBandMessageFromItem(i Item) (InBandMessage, error)
	MakeMessageFromInBandMessage(i InBandMessage) (Message, error)
	MakeTimeOrOffsetFromTime(t time.Time) (TimeOrOffset, error)
	MakeTimeOrOffsetFromOffset(d time.Duration) (TimeOrOffset, error)
	MakeReminderSetFromReminders([]Reminder, bool) (ReminderSet, error)
	UnmarshalState([]byte) (State, error)
	UnmarshalMessage([]byte) (Message, error)
}

type MainLoopServer interface {
	ListenLoop(n net.Listener) error
}

func UIDFromMessage(m Message) UID {
	ibm := m.ToInBandMessage()
	if ibm != nil && ibm.Metadata() != nil {
		return ibm.Metadata().UID()
	}
	if oobm := m.ToOutOfBandMessage(); oobm != nil {
		return oobm.UID()
	}
	return nil
}
