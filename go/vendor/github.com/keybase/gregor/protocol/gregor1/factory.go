package gregor1

import (
	"bytes"
	"errors"
	"sort"
	"time"

	"github.com/keybase/go-codec/codec"
	"github.com/keybase/gregor"
)

type ObjFactory struct{}

func (o ObjFactory) MakeUID(b []byte) (gregor.UID, error)           { return UID(b), nil }
func (o ObjFactory) MakeMsgID(b []byte) (gregor.MsgID, error)       { return MsgID(b), nil }
func (o ObjFactory) MakeDeviceID(b []byte) (gregor.DeviceID, error) { return DeviceID(b), nil }
func (o ObjFactory) MakeBody(b []byte) (gregor.Body, error)         { return Body(b), nil }
func (o ObjFactory) MakeCategory(s string) (gregor.Category, error) { return Category(s), nil }

func castUID(uid gregor.UID) (ret UID, err error) {
	if uid == nil {
		return
	}
	ret, ok := uid.(UID)
	if !ok {
		err = errors.New("bad UID; wrong type")
	}
	return
}

func castDeviceID(d gregor.DeviceID) (ret DeviceID, err error) {
	if d == nil {
		return
	}
	ret, ok := d.(DeviceID)
	if !ok {
		err = errors.New("bad Device ID; wrong type")
	}
	return
}

func castItem(i gregor.Item) (ret ItemAndMetadata, err error) {
	ret, ok := i.(ItemAndMetadata)
	if !ok {
		err = errors.New("bad Item; wrong type")
	}
	return
}

func castInBandMessage(i gregor.InBandMessage) (ret InBandMessage, err error) {
	ret, ok := i.(InBandMessage)
	if !ok {
		err = errors.New("bad InBandMessage; wrong type")
	}
	return
}

func timeToTimeOrOffset(timeIn *time.Time) (too TimeOrOffset) {
	if timeIn != nil {
		too.Time_ = ToTime(*timeIn)
	}
	return
}

func (o ObjFactory) makeMetadata(uid gregor.UID, msgid gregor.MsgID, devid gregor.DeviceID, ctime time.Time, i gregor.InBandMsgType) (Metadata, error) {
	uid2, e := castUID(uid)
	if e != nil {
		return Metadata{}, e
	}
	devid2, e := castDeviceID(devid)
	if e != nil {
		return Metadata{}, e
	}

	return Metadata{
		Uid_:           uid2,
		MsgID_:         MsgID(msgid.Bytes()),
		Ctime_:         ToTime(ctime),
		DeviceID_:      devid2,
		InBandMsgType_: int(i),
	}, nil
}

func (o ObjFactory) makeItem(c gregor.Category, d *time.Time, b gregor.Body) *Item {
	return &Item{
		Dtime_:    timeToTimeOrOffset(d),
		Category_: Category(c.String()),
		Body_:     Body(b.Bytes()),
	}
}

func (o ObjFactory) MakeItem(u gregor.UID, msgid gregor.MsgID, deviceid gregor.DeviceID, ctime time.Time, c gregor.Category, dtime *time.Time, body gregor.Body) (gregor.Item, error) {
	md, err := o.makeMetadata(u, msgid, deviceid, ctime, gregor.InBandMsgTypeUpdate)
	if err != nil {
		return nil, err
	}
	return ItemAndMetadata{
		Md_:   &md,
		Item_: o.makeItem(c, dtime, body),
	}, nil
}

func (o ObjFactory) MakeReminder(i gregor.Item, seqno int, t time.Time) (gregor.Reminder, error) {
	it, ok := i.(ItemAndMetadata)
	if !ok {
		return nil, errors.New("item is not gregor1.ItemAndMetadata")
	}
	return Reminder{
		Item_:       it,
		Seqno_:      seqno,
		RemindTime_: ToTime(t),
	}, nil
}

func (o ObjFactory) MakeDismissalByRange(uid gregor.UID, msgid gregor.MsgID, devid gregor.DeviceID, ctime time.Time, c gregor.Category, d time.Time) (gregor.InBandMessage, error) {
	md, err := o.makeMetadata(uid, msgid, devid, ctime, gregor.InBandMsgTypeUpdate)
	if err != nil {
		return nil, err
	}
	return InBandMessage{
		StateUpdate_: &StateUpdateMessage{
			Md_: md,
			Dismissal_: &Dismissal{
				Ranges_: []MsgRange{{
					EndTime_:  timeToTimeOrOffset(&d),
					Category_: Category(c.String()),
				}},
			},
		},
	}, nil
}

func (o ObjFactory) MakeDismissalByIDs(uid gregor.UID, msgid gregor.MsgID, devid gregor.DeviceID, ctime time.Time, ids []gregor.MsgID) (gregor.InBandMessage, error) {
	md, err := o.makeMetadata(uid, msgid, devid, ctime, gregor.InBandMsgTypeUpdate)
	if err != nil {
		return nil, err
	}
	ourIds := make([]MsgID, len(ids), len(ids))
	for i, id := range ids {
		ourIds[i] = MsgID(id.Bytes())
	}
	return InBandMessage{
		StateUpdate_: &StateUpdateMessage{
			Md_: md,
			Dismissal_: &Dismissal{
				MsgIDs_: ourIds,
			},
		},
	}, nil
}

func (o ObjFactory) MakeStateSyncMessage(uid gregor.UID, msgid gregor.MsgID, devid gregor.DeviceID, ctime time.Time) (gregor.InBandMessage, error) {
	md, err := o.makeMetadata(uid, msgid, devid, ctime, gregor.InBandMsgTypeUpdate)
	if err != nil {
		return nil, err
	}
	return InBandMessage{
		StateSync_: &StateSyncMessage{
			Md_: md,
		},
	}, nil
}

type itemSlice []ItemAndMetadata

func (its itemSlice) Len() int      { return len(its) }
func (its itemSlice) Swap(i, j int) { its[i], its[j] = its[j], its[i] }

// Less returns true if i's ctime is before j's, or if they're equal and
// i's MsgID is lexicographically before j's.
func (its itemSlice) Less(i, j int) bool {
	mI, mJ := its[i].Metadata(), its[j].Metadata()
	if mI != nil && mJ != nil {
		if mI.CTime().Equal(mJ.CTime()) {
			if mI.MsgID() != nil && mJ.MsgID() != nil {
				return bytes.Compare(mI.MsgID().Bytes(), mJ.MsgID().Bytes()) < 0
			} else {
				return mI.MsgID() == nil
			}
		}
		return mI.CTime().Before(mJ.CTime())
	}
	return mI == nil
}

func (o ObjFactory) MakeState(items []gregor.Item) (gregor.State, error) {
	var ourItems itemSlice
	for _, item := range items {
		ourItem, err := castItem(item)
		if err != nil {
			return nil, err
		}
		ourItems = append(ourItems, ourItem)
	}
	sort.Sort(ourItems)
	return State{Items_: ourItems}, nil
}

func (o ObjFactory) MakeMetadata(uid gregor.UID, msgid gregor.MsgID, devid gregor.DeviceID, ctime time.Time, i gregor.InBandMsgType) (gregor.Metadata, error) {
	return o.makeMetadata(uid, msgid, devid, ctime, gregor.InBandMsgTypeUpdate)
}

func (o ObjFactory) MakeInBandMessageFromItem(i gregor.Item) (gregor.InBandMessage, error) {
	ourItem, err := castItem(i)
	if err != nil {
		return nil, err
	}
	return InBandMessage{
		StateUpdate_: &StateUpdateMessage{
			Md_:       *ourItem.Md_,
			Creation_: ourItem.Item_,
		},
	}, nil
}

func (o ObjFactory) MakeMessageFromInBandMessage(i gregor.InBandMessage) (gregor.Message, error) {
	ourInBandMessage, err := castInBandMessage(i)
	if err != nil {
		return nil, err
	}
	return Message{
		Ibm_: &ourInBandMessage,
	}, nil
}

func (o ObjFactory) UnmarshalState(b []byte) (gregor.State, error) {
	var state State
	err := codec.NewDecoderBytes(b, &codec.MsgpackHandle{WriteExt: true}).
		Decode(&state)
	if err != nil {
		return nil, err
	}

	return state, nil
}

func (o ObjFactory) MakeTimeOrOffsetFromTime(t time.Time) (gregor.TimeOrOffset, error) {
	return timeToTimeOrOffset(&t), nil
}

func (o ObjFactory) MakeTimeOrOffsetFromOffset(d time.Duration) (gregor.TimeOrOffset, error) {
	return TimeOrOffset{Offset_: DurationMsec(d / time.Millisecond)}, nil
}

func (o ObjFactory) MakeReminderID(u gregor.UID, msgid gregor.MsgID, seqno int) (gregor.ReminderID, error) {
	return ReminderID{Uid_: u.Bytes(), MsgID_: msgid.Bytes(), Seqno_: seqno}, nil
}

func (o ObjFactory) MakeReminderSetFromReminders(reminders []gregor.Reminder, moreRemindersReady bool) (gregor.ReminderSet, error) {
	ret := ReminderSet{MoreRemindersReady_: moreRemindersReady}
	for _, reminder := range reminders {
		if r, ok := reminder.(Reminder); ok {
			ret.Reminders_ = append(ret.Reminders_, r)
		} else {
			return nil, errors.New("Can't upcast reminder")
		}
	}
	return ret, nil
}

var _ gregor.ObjFactory = ObjFactory{}
