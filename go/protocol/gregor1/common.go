// Auto-generated to Go types and interfaces using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/gregor1/common.avdl

package gregor1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type TimeOrOffset struct {
	Time_   Time         `codec:"time" json:"time"`
	Offset_ DurationMsec `codec:"offset" json:"offset"`
}

func (o TimeOrOffset) DeepCopy() TimeOrOffset {
	return TimeOrOffset{
		Time_:   o.Time_.DeepCopy(),
		Offset_: o.Offset_.DeepCopy(),
	}
}

type Metadata struct {
	Uid_           UID      `codec:"uid" json:"uid"`
	MsgID_         MsgID    `codec:"msgID" json:"msgID"`
	Ctime_         Time     `codec:"ctime" json:"ctime"`
	DeviceID_      DeviceID `codec:"deviceID" json:"deviceID"`
	InBandMsgType_ int      `codec:"inBandMsgType" json:"inBandMsgType"`
}

func (o Metadata) DeepCopy() Metadata {
	return Metadata{
		Uid_:           o.Uid_.DeepCopy(),
		MsgID_:         o.MsgID_.DeepCopy(),
		Ctime_:         o.Ctime_.DeepCopy(),
		DeviceID_:      o.DeviceID_.DeepCopy(),
		InBandMsgType_: o.InBandMsgType_,
	}
}

type InBandMessage struct {
	StateUpdate_ *StateUpdateMessage `codec:"stateUpdate,omitempty" json:"stateUpdate,omitempty"`
	StateSync_   *StateSyncMessage   `codec:"stateSync,omitempty" json:"stateSync,omitempty"`
}

func (o InBandMessage) DeepCopy() InBandMessage {
	return InBandMessage{
		StateUpdate_: (func(x *StateUpdateMessage) *StateUpdateMessage {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.StateUpdate_),
		StateSync_: (func(x *StateSyncMessage) *StateSyncMessage {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.StateSync_),
	}
}

type State struct {
	Items_ []ItemAndMetadata `codec:"items" json:"items"`
}

func (o State) DeepCopy() State {
	return State{
		Items_: (func(x []ItemAndMetadata) []ItemAndMetadata {
			if x == nil {
				return nil
			}
			ret := make([]ItemAndMetadata, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Items_),
	}
}

type StateUpdateMessage struct {
	Md_        Metadata   `codec:"md" json:"md"`
	Creation_  *Item      `codec:"creation,omitempty" json:"creation,omitempty"`
	Dismissal_ *Dismissal `codec:"dismissal,omitempty" json:"dismissal,omitempty"`
}

func (o StateUpdateMessage) DeepCopy() StateUpdateMessage {
	return StateUpdateMessage{
		Md_: o.Md_.DeepCopy(),
		Creation_: (func(x *Item) *Item {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Creation_),
		Dismissal_: (func(x *Dismissal) *Dismissal {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Dismissal_),
	}
}

type StateSyncMessage struct {
	Md_ Metadata `codec:"md" json:"md"`
}

func (o StateSyncMessage) DeepCopy() StateSyncMessage {
	return StateSyncMessage{
		Md_: o.Md_.DeepCopy(),
	}
}

type MsgRange struct {
	EndTime_    TimeOrOffset `codec:"endTime" json:"endTime"`
	Category_   Category     `codec:"category" json:"category"`
	SkipMsgIDs_ []MsgID      `codec:"skipMsgIDs" json:"skipMsgIDs"`
}

func (o MsgRange) DeepCopy() MsgRange {
	return MsgRange{
		EndTime_:  o.EndTime_.DeepCopy(),
		Category_: o.Category_.DeepCopy(),
		SkipMsgIDs_: (func(x []MsgID) []MsgID {
			if x == nil {
				return nil
			}
			ret := make([]MsgID, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.SkipMsgIDs_),
	}
}

type Dismissal struct {
	MsgIDs_ []MsgID    `codec:"msgIDs" json:"msgIDs"`
	Ranges_ []MsgRange `codec:"ranges" json:"ranges"`
}

func (o Dismissal) DeepCopy() Dismissal {
	return Dismissal{
		MsgIDs_: (func(x []MsgID) []MsgID {
			if x == nil {
				return nil
			}
			ret := make([]MsgID, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.MsgIDs_),
		Ranges_: (func(x []MsgRange) []MsgRange {
			if x == nil {
				return nil
			}
			ret := make([]MsgRange, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Ranges_),
	}
}

type Item struct {
	Category_    Category       `codec:"category" json:"category"`
	Dtime_       TimeOrOffset   `codec:"dtime" json:"dtime"`
	RemindTimes_ []TimeOrOffset `codec:"remindTimes" json:"remindTimes"`
	Body_        Body           `codec:"body" json:"body"`
}

func (o Item) DeepCopy() Item {
	return Item{
		Category_: o.Category_.DeepCopy(),
		Dtime_:    o.Dtime_.DeepCopy(),
		RemindTimes_: (func(x []TimeOrOffset) []TimeOrOffset {
			if x == nil {
				return nil
			}
			ret := make([]TimeOrOffset, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RemindTimes_),
		Body_: o.Body_.DeepCopy(),
	}
}

type ItemAndMetadata struct {
	Md_   *Metadata `codec:"md,omitempty" json:"md,omitempty"`
	Item_ *Item     `codec:"item,omitempty" json:"item,omitempty"`
}

func (o ItemAndMetadata) DeepCopy() ItemAndMetadata {
	return ItemAndMetadata{
		Md_: (func(x *Metadata) *Metadata {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Md_),
		Item_: (func(x *Item) *Item {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Item_),
	}
}

type Reminder struct {
	Item_       ItemAndMetadata `codec:"item" json:"item"`
	Seqno_      int             `codec:"seqno" json:"seqno"`
	RemindTime_ Time            `codec:"remindTime" json:"remindTime"`
}

func (o Reminder) DeepCopy() Reminder {
	return Reminder{
		Item_:       o.Item_.DeepCopy(),
		Seqno_:      o.Seqno_,
		RemindTime_: o.RemindTime_.DeepCopy(),
	}
}

type ReminderID struct {
	Uid_   UID   `codec:"uid" json:"uid"`
	MsgID_ MsgID `codec:"msgID" json:"msgID"`
	Seqno_ int   `codec:"seqno" json:"seqno"`
}

func (o ReminderID) DeepCopy() ReminderID {
	return ReminderID{
		Uid_:   o.Uid_.DeepCopy(),
		MsgID_: o.MsgID_.DeepCopy(),
		Seqno_: o.Seqno_,
	}
}

type OutOfBandMessage struct {
	Uid_    UID    `codec:"uid" json:"uid"`
	System_ System `codec:"system" json:"system"`
	Body_   Body   `codec:"body" json:"body"`
}

func (o OutOfBandMessage) DeepCopy() OutOfBandMessage {
	return OutOfBandMessage{
		Uid_:    o.Uid_.DeepCopy(),
		System_: o.System_.DeepCopy(),
		Body_:   o.Body_.DeepCopy(),
	}
}

type ReminderSet struct {
	Reminders_          []Reminder `codec:"reminders" json:"reminders"`
	MoreRemindersReady_ bool       `codec:"moreRemindersReady" json:"moreRemindersReady"`
}

func (o ReminderSet) DeepCopy() ReminderSet {
	return ReminderSet{
		Reminders_: (func(x []Reminder) []Reminder {
			if x == nil {
				return nil
			}
			ret := make([]Reminder, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Reminders_),
		MoreRemindersReady_: o.MoreRemindersReady_,
	}
}

type Message struct {
	Oobm_ *OutOfBandMessage `codec:"oobm,omitempty" json:"oobm,omitempty"`
	Ibm_  *InBandMessage    `codec:"ibm,omitempty" json:"ibm,omitempty"`
}

func (o Message) DeepCopy() Message {
	return Message{
		Oobm_: (func(x *OutOfBandMessage) *OutOfBandMessage {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Oobm_),
		Ibm_: (func(x *InBandMessage) *InBandMessage {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Ibm_),
	}
}

type DurationMsec int64

func (o DurationMsec) DeepCopy() DurationMsec {
	return o
}

type DurationSec int64

func (o DurationSec) DeepCopy() DurationSec {
	return o
}

type Category string

func (o Category) DeepCopy() Category {
	return o
}

type System string

func (o System) DeepCopy() System {
	return o
}

type UID []byte

func (o UID) DeepCopy() UID {
	return (func(x []byte) []byte {
		if x == nil {
			return nil
		}
		return append([]byte{}, x...)
	})(o)
}

type MsgID []byte

func (o MsgID) DeepCopy() MsgID {
	return (func(x []byte) []byte {
		if x == nil {
			return nil
		}
		return append([]byte{}, x...)
	})(o)
}

type DeviceID []byte

func (o DeviceID) DeepCopy() DeviceID {
	return (func(x []byte) []byte {
		if x == nil {
			return nil
		}
		return append([]byte{}, x...)
	})(o)
}

type Body []byte

func (o Body) DeepCopy() Body {
	return (func(x []byte) []byte {
		if x == nil {
			return nil
		}
		return append([]byte{}, x...)
	})(o)
}

type Time int64

func (o Time) DeepCopy() Time {
	return o
}

type SessionID string

func (o SessionID) DeepCopy() SessionID {
	return o
}

type SessionToken string

func (o SessionToken) DeepCopy() SessionToken {
	return o
}

type CommonInterface interface {
}

func CommonProtocol(i CommonInterface) rpc.Protocol {
	return rpc.Protocol{
		Name:    "gregor.1.common",
		Methods: map[string]rpc.ServeHandlerDescription{},
	}
}

type CommonClient struct {
	Cli rpc.GenericClient
}
