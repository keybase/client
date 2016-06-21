package gregor1

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/keybase/go-codec/codec"
	"github.com/keybase/gregor"
)

func (u UID) Bytes() []byte                   { return []byte(u) }
func (u UID) String() string                  { return hex.EncodeToString(u) }
func (d DeviceID) Bytes() []byte              { return []byte(d) }
func (d DeviceID) String() string             { return hex.EncodeToString(d) }
func (m MsgID) Bytes() []byte                 { return []byte(m) }
func (m MsgID) String() string                { return hex.EncodeToString(m) }
func (s System) String() string               { return string(s) }
func (c Category) String() string             { return string(c) }
func (b Body) Bytes() []byte                  { return []byte(b) }
func (c Category) Eq(c2 Category) bool        { return string(c) == string(c2) }
func (c Category) HasPrefix(c2 Category) bool { return strings.HasPrefix(string(c), string(c2)) }

func (t TimeOrOffset) Time() *time.Time {
	if t.Time_.IsZero() {
		return nil
	}
	ret := FromTime(t.Time_)
	return &ret
}
func (t TimeOrOffset) Offset() *time.Duration {
	if t.Offset_ == 0 {
		return nil
	}
	d := time.Duration(t.Offset_) * time.Millisecond
	return &d
}

func (s StateSyncMessage) Metadata() gregor.Metadata {
	return s.Md_
}

func (m MsgRange) EndTime() gregor.TimeOrOffset {
	return m.EndTime_
}
func (m MsgRange) Category() gregor.Category {
	return m.Category_
}

func (d Dismissal) RangesToDismiss() []gregor.MsgRange {
	var ret []gregor.MsgRange
	for _, r := range d.Ranges_ {
		ret = append(ret, r)
	}
	return ret
}

func (d Dismissal) MsgIDsToDismiss() []gregor.MsgID {
	var ret []gregor.MsgID
	for _, m := range d.MsgIDs_ {
		ret = append(ret, m)
	}
	return ret
}

func (m Metadata) CTime() time.Time { return FromTime(m.Ctime_) }
func (m Metadata) UID() gregor.UID {
	if m.Uid_ == nil {
		return nil
	}
	return m.Uid_
}
func (m Metadata) MsgID() gregor.MsgID {
	if m.MsgID_ == nil {
		return nil
	}
	return m.MsgID_
}
func (m Metadata) DeviceID() gregor.DeviceID {
	if m.DeviceID_ == nil {
		return nil
	}
	return m.DeviceID_
}
func (m Metadata) InBandMsgType() gregor.InBandMsgType { return gregor.InBandMsgType(m.InBandMsgType_) }

func (m Metadata) String() string {
	return fmt.Sprintf("[ CTime: %s Type: %s ID: %s UID: %s ]", m.CTime(),
		m.InBandMsgType(), m.MsgID(), m.UID())
}

func (i ItemAndMetadata) Metadata() gregor.Metadata {
	if i.Md_ == nil {
		return nil
	}
	return i.Md_
}
func (i ItemAndMetadata) Body() gregor.Body {
	if i.Item_.Body_ == nil {
		return nil
	}
	return i.Item_.Body_
}
func (i ItemAndMetadata) Category() gregor.Category {
	if i.Item_.Category_ == "" {
		return nil
	}
	return i.Item_.Category_
}
func (i ItemAndMetadata) DTime() gregor.TimeOrOffset {
	var unset TimeOrOffset
	if i.Item_.Dtime_ == unset {
		return nil
	}
	return i.Item_.Dtime_
}
func (i ItemAndMetadata) RemindTimes() []gregor.TimeOrOffset {
	var ret []gregor.TimeOrOffset
	for _, t := range i.Item_.RemindTimes_ {
		ret = append(ret, t)
	}
	return ret
}

func (i ItemAndMetadata) String() string {
	rts := "[ "
	for _, rt := range i.RemindTimes() {
		rts += fmt.Sprintf("[%s,%s]", rt.Time(), rt.Offset())
	}
	rts += "]"
	return fmt.Sprintf("MD: %s Cat: %s DTime: %s RTs: %s Body: %s", i.Metadata(),
		i.Category(), i.DTime(), rts, i.Body())
}

func (s StateUpdateMessage) Metadata() gregor.Metadata { return s.Md_ }
func (s StateUpdateMessage) Creation() gregor.Item {
	if s.Creation_ == nil {
		return nil
	}
	return ItemAndMetadata{Md_: &s.Md_, Item_: s.Creation_}
}
func (s StateUpdateMessage) Dismissal() gregor.Dismissal {
	if s.Dismissal_ == nil {
		return nil
	}
	return s.Dismissal_
}

func (i InBandMessage) Merge(i2 gregor.InBandMessage) error {
	t2, ok := i2.(InBandMessage)
	if !ok {
		return fmt.Errorf("bad merge; wrong type: %T", i2)
	}
	if i.StateSync_ != nil || t2.StateSync_ != nil {
		return errors.New("Cannot merge sync messages")
	}
	return i.StateUpdate_.Merge(t2.StateUpdate_)
}

func (s StateUpdateMessage) Merge(s2 *StateUpdateMessage) error {
	if s.Creation_ != nil && s2.Creation_ != nil {
		return errors.New("clash of creations")
	}
	if s.Creation_ == nil {
		s.Creation_ = s2.Creation_
	}
	if s.Dismissal_ == nil {
		s.Dismissal_ = s2.Dismissal_
	} else if s.Dismissal_ != nil {
		s.Dismissal_.MsgIDs_ = append(s.Dismissal_.MsgIDs_, s2.Dismissal_.MsgIDs_...)
		s.Dismissal_.Ranges_ = append(s.Dismissal_.Ranges_, s2.Dismissal_.Ranges_...)
	}
	return nil
}

func (i InBandMessage) Metadata() gregor.Metadata {
	if i.StateUpdate_ != nil {
		return i.StateUpdate_.Md_
	}
	if i.StateSync_ != nil {
		return i.StateSync_.Md_
	}
	return nil
}

func (i InBandMessage) ToStateSyncMessage() gregor.StateSyncMessage {
	if i.StateSync_ == nil {
		return nil
	}
	return i.StateSync_
}

func (i InBandMessage) ToStateUpdateMessage() gregor.StateUpdateMessage {
	if i.StateUpdate_ == nil {
		return nil
	}
	return i.StateUpdate_
}

func (o OutOfBandMessage) Body() gregor.Body {
	if o.Body_ == nil {
		return nil
	}
	return o.Body_
}
func (o OutOfBandMessage) System() gregor.System {
	if o.System_ == "" {
		return nil
	}
	return o.System_
}
func (o OutOfBandMessage) UID() gregor.UID {
	if o.Uid_ == nil {
		return nil
	}
	return o.Uid_
}

func (m Message) ToInBandMessage() gregor.InBandMessage {
	if m.Ibm_ == nil {
		return nil
	}
	return *m.Ibm_
}

func (m Message) ToOutOfBandMessage() gregor.OutOfBandMessage {
	if m.Oobm_ == nil {
		return nil
	}
	return *m.Oobm_
}

func (m *Message) SetCTime(ctime time.Time) {
	if m.Ibm_ != nil && m.Ibm_.StateUpdate_ != nil {
		m.Ibm_.StateUpdate_.Md_.Ctime_ = ToTime(ctime)
	}
}

func (r Reminder) Item() gregor.Item     { return r.Item_ }
func (r Reminder) RemindTime() time.Time { return FromTime(r.RemindTime_) }
func (r Reminder) Seqno() int            { return r.Seqno_ }

func (r ReminderID) UID() gregor.UID     { return r.Uid_ }
func (r ReminderID) MsgID() gregor.MsgID { return r.MsgID_ }
func (r ReminderID) Seqno() int          { return r.Seqno_ }

func (s State) Items() ([]gregor.Item, error) {
	var ret []gregor.Item
	for _, i := range s.Items_ {
		ret = append(ret, i)
	}
	return ret, nil
}

func (s State) Marshal() ([]byte, error) {
	var b []byte
	err := codec.NewEncoderBytes(&b, &codec.MsgpackHandle{WriteExt: true}).Encode(s)
	return b, err
}

func (s State) Hash() ([]byte, error) {
	b, err := s.Marshal()
	if err != nil {
		return nil, err
	}

	sum := sha256.Sum256(b)
	return sum[:], nil
}

func (i ItemAndMetadata) InCategory(c Category) bool {
	return i.Item_.Category_.Eq(c)
}

func (i ItemAndMetadata) HasCategoryPrefix(c Category) bool {
	return i.Item_.Category_.HasPrefix(c)
}

func (s State) ItemsInCategory(gc gregor.Category) ([]gregor.Item, error) {
	var ret []gregor.Item
	c := Category(gc.String())
	for _, i := range s.Items_ {
		if i.InCategory(c) {
			ret = append(ret, i)
		}
	}
	return ret, nil
}

func (s State) ItemsWithCategoryPrefix(gc gregor.Category) ([]gregor.Item, error) {
	var ret []gregor.Item
	c := Category(gc.String())
	for _, i := range s.Items_ {
		if i.HasCategoryPrefix(c) {
			ret = append(ret, i)
		}
	}
	return ret, nil
}

func FromTime(t Time) time.Time {
	if t == 0 {
		return time.Time{}
	}
	return time.Unix(0, int64(t)*1000000)
}

// copied from keybase/client/go/protocol/extras.go. Consider eventually a
// refactor to allow this code to be shared.
func ToTime(t time.Time) Time {
	// the result of calling UnixNano on the zero Time is undefined.
	// https://golang.org/pkg/time/#Time.UnixNano
	if t.IsZero() {
		return 0
	}
	return Time(t.UnixNano() / 1000000)
}

func TimeFromSeconds(seconds int64) Time {
	return Time(seconds * 1000)
}

func (t Time) IsZero() bool        { return t == 0 }
func (t Time) After(t2 Time) bool  { return t > t2 }
func (t Time) Before(t2 Time) bool { return t < t2 }

func FormatTime(t Time) string {
	layout := "2006-01-02 15:04:05 MST"
	return FromTime(t).Format(layout)
}

// DeviceID returns the deviceID in a SyncArc, or interface nil
// (and not gregor1.DeviceID(nil)) if not was specified.
func (s SyncArg) DeviceID() gregor.DeviceID {
	if s.Deviceid == nil {
		return nil
	}
	return s.Deviceid
}

// UID returns the UID in a SyncArc, or interface nil
// (and not gregor1.UID(nil)) if not was specified.
func (s SyncArg) UID() gregor.UID {
	if s.Uid == nil {
		return nil
	}
	return s.Uid
}

func (s SyncArg) CTime() time.Time {
	return FromTime(s.Ctime)
}

func (r ReminderSet) Reminders() []gregor.Reminder {
	var out []gregor.Reminder
	for _, reminder := range r.Reminders_ {
		out = append(out, reminder)
	}
	return out
}

func (r ReminderSet) MoreRemindersReady() bool { return r.MoreRemindersReady_ }

var _ gregor.UID = UID{}
var _ gregor.MsgID = MsgID{}
var _ gregor.DeviceID = DeviceID{}
var _ gregor.System = System("")
var _ gregor.Body = Body{}
var _ gregor.Category = Category("")
var _ gregor.TimeOrOffset = TimeOrOffset{}
var _ gregor.Metadata = Metadata{}
var _ gregor.StateSyncMessage = StateSyncMessage{}
var _ gregor.MsgRange = MsgRange{}
var _ gregor.Dismissal = Dismissal{}
var _ gregor.Item = ItemAndMetadata{}
var _ gregor.Reminder = Reminder{}
var _ gregor.StateUpdateMessage = StateUpdateMessage{}
var _ gregor.InBandMessage = InBandMessage{}
var _ gregor.OutOfBandMessage = OutOfBandMessage{}
var _ gregor.Message = Message{}
var _ gregor.State = State{}
var _ gregor.ReminderID = ReminderID{}
var _ gregor.ReminderSet = ReminderSet{}
