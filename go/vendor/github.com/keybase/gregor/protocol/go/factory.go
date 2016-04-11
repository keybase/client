package gregor1

import (
	"encoding/hex"
	"fmt"
	"time"

	"github.com/keybase/gregor"
)

type ObjFactory struct{}

func (o ObjFactory) MakeUID(b []byte) (gregor.UID, error)     { return UID(hex.EncodeToString(b)), nil }
func (o ObjFactory) MakeMsgID(b []byte) (gregor.MsgID, error) { return MsgID(b), nil }
func (o ObjFactory) MakeDeviceID(b []byte) (gregor.DeviceID, error) {
	return DeviceID(hex.EncodeToString(b)), nil
}
func (o ObjFactory) MakeBody(b []byte) (gregor.Body, error)         { return Body(b), nil }
func (o ObjFactory) MakeCategory(s string) (gregor.Category, error) { return Category(s), nil }

func castUID(uid gregor.UID) (UID, error) {
	ret, ok := uid.(UID)
	if !ok {
		return UID(""), fmt.Errorf("Bad UID; wrong type")
	}
	return ret, nil
}

func castDeviceID(d gregor.DeviceID) (DeviceID, error) {
	ret, ok := d.(DeviceID)
	if !ok {
		return DeviceID(""), fmt.Errorf("Bad Device ID; wrong type")
	}
	return ret, nil
}

func castItem(i gregor.Item) (ItemAndMetadata, error) {
	ret, ok := i.(ItemAndMetadata)
	if !ok {
		return ItemAndMetadata{}, fmt.Errorf("Bad Item; wrong type")
	}
	return ret, nil
}

func timeToTimeOrOffset(timeIn *time.Time) TimeOrOffset {
	var timeOut Time
	if timeIn != nil && !timeIn.IsZero() {
		timeOut = ToTime(*timeIn)
	}
	return TimeOrOffset{
		Offset_: 0,
		Time_:   timeOut,
	}
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

func (o ObjFactory) makeItem(c gregor.Category, d *time.Time, b gregor.Body) (Item, error) {
	return Item{
		Dtime_:    timeToTimeOrOffset(d),
		Category_: Category(c.String()),
		Body_:     Body(b.Bytes()),
	}, nil
}

func (o ObjFactory) MakeItem(u gregor.UID, msgid gregor.MsgID, deviceid gregor.DeviceID, ctime time.Time, c gregor.Category, dtime *time.Time, body gregor.Body) (gregor.Item, error) {
	md, err := o.makeMetadata(u, msgid, deviceid, ctime, gregor.InBandMsgTypeUpdate)
	if err != nil {
		return nil, err
	}
	item, err := o.makeItem(c, dtime, body)
	if err != nil {
		return nil, err
	}
	return ItemAndMetadata{
		md: &md,
		i:  &item,
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

func (o ObjFactory) MakeDismissalByID(uid gregor.UID, msgid gregor.MsgID, devid gregor.DeviceID, ctime time.Time, d gregor.MsgID) (gregor.InBandMessage, error) {
	md, err := o.makeMetadata(uid, msgid, devid, ctime, gregor.InBandMsgTypeUpdate)
	if err != nil {
		return nil, err
	}
	return InBandMessage{
		StateUpdate_: &StateUpdateMessage{
			Md_: md,
			Dismissal_: &Dismissal{
				MsgIDs_: []MsgID{MsgID(d.Bytes())},
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

func (o ObjFactory) MakeState(items []gregor.Item) (gregor.State, error) {
	var ourItems []ItemAndMetadata
	for _, item := range items {
		ourItem, err := castItem(item)
		if err != nil {
			return nil, err
		}
		ourItems = append(ourItems, ourItem)
	}
	return State{items: ourItems}, nil
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
			Md_:       *ourItem.md,
			Creation_: ourItem.i,
		},
	}, nil
}

var _ gregor.ObjFactory = ObjFactory{}
