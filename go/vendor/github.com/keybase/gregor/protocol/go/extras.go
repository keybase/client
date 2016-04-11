package gregor1

import (
	"errors"
	"fmt"
	"time"

	gregor "github.com/keybase/gregor"
)

func (u UID) Bytes() []byte            { return []byte(u) }
func (d DeviceID) Bytes() []byte       { return []byte(d) }
func (m MsgID) Bytes() []byte          { return []byte(m) }
func (s System) String() string        { return string(s) }
func (c Category) String() string      { return string(c) }
func (b Body) Bytes() []byte           { return []byte(b) }
func (c Category) Eq(c2 Category) bool { return string(c) == string(c2) }

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

type ItemAndMetadata struct {
	md *Metadata
	i  *Item
}

func (m Metadata) UID() gregor.UID                   { return m.Uid_ }
func (i ItemAndMetadata) Metadata() gregor.Metadata  { return *i.md }
func (i ItemAndMetadata) Body() gregor.Body          { return i.i.Body_ }
func (i ItemAndMetadata) Category() gregor.Category  { return i.i.Category_ }
func (i ItemAndMetadata) DTime() gregor.TimeOrOffset { return i.i.Dtime_ }
func (i ItemAndMetadata) NotifyTimes() []gregor.TimeOrOffset {
	var ret []gregor.TimeOrOffset
	for _, t := range i.i.NotifyTimes_ {
		ret = append(ret, t)
	}
	return ret
}

func (s StateUpdateMessage) Metadata() gregor.Metadata { return s.Md_ }
func (s StateUpdateMessage) Creation() gregor.Item {
	if s.Creation_ != nil {
		return nil
	}
	return ItemAndMetadata{md: &s.Md_, i: s.Creation_}
}
func (s StateUpdateMessage) Dismissal() gregor.Dismissal {
	if s.Dismissal_ != nil {
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

func (m Metadata) MsgID() gregor.MsgID                 { return m.MsgID_ }
func (m Metadata) CTime() time.Time                    { return FromTime(m.Ctime_) }
func (m Metadata) SetCTime(t time.Time)                { m.Ctime_ = ToTime(t) }
func (m Metadata) DeviceID() gregor.DeviceID           { return m.DeviceID_ }
func (m Metadata) InBandMsgType() gregor.InBandMsgType { return gregor.InBandMsgType(m.InBandMsgType_) }

func (o OutOfBandMessage) Body() gregor.Body     { return o.Body_ }
func (o OutOfBandMessage) System() gregor.System { return o.System_ }
func (o OutOfBandMessage) UID() gregor.UID       { return o.Uid_ }

func (m Message) ToInBandMessage() gregor.InBandMessage {
	if m.Ibm_ == nil {
		return nil
	}
	return m.Ibm_
}

func (m Message) ToOutOfBandMessage() gregor.OutOfBandMessage {
	if m.Oobm_ == nil {
		return nil
	}
	return m.Oobm_
}

type State struct {
	items []ItemAndMetadata
}

func (s State) Items() ([]gregor.Item, error) {
	var ret []gregor.Item
	for _, i := range s.items {
		ret = append(ret, i)
	}
	return ret, nil
}

func (i ItemAndMetadata) InCategory(c Category) bool {
	return i.i.Category_.Eq(c)
}

func (s State) ItemsInCategory(gc gregor.Category) ([]gregor.Item, error) {
	var ret []gregor.Item
	c := Category(gc.String())
	for _, i := range s.items {
		if i.InCategory(c) {
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
var _ gregor.StateUpdateMessage = StateUpdateMessage{}
var _ gregor.InBandMessage = InBandMessage{}
var _ gregor.OutOfBandMessage = OutOfBandMessage{}
var _ gregor.Message = Message{}
var _ gregor.State = State{}
