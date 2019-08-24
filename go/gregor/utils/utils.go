package utils

import (
	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/net/context"
)

func NewGregorMsgID() (gregor1.MsgID, error) {
	r, err := libkb.RandBytes(16)
	if err != nil {
		return nil, err
	}
	return gregor1.MsgID(r), nil
}

func TemplateMessage(uid gregor1.UID) (gregor1.Message, error) {
	newMsgID, err := NewGregorMsgID()
	if err != nil {
		return gregor1.Message{}, err
	}
	return gregor1.Message{
		Ibm_: &gregor1.InBandMessage{
			StateUpdate_: &gregor1.StateUpdateMessage{
				Md_: gregor1.Metadata{
					Uid_:   uid,
					MsgID_: newMsgID,
				},
			},
		},
	}, nil
}

func FormMessageForInjectItem(ctx context.Context, uid gregor1.UID, cat string, body []byte,
	dtime gregor1.TimeOrOffset) (gregor.Message, error) {
	creation, err := TemplateMessage(uid)
	if err != nil {
		return nil, err
	}
	creation.Ibm_.StateUpdate_.Creation_ = &gregor1.Item{
		Category_: gregor1.Category(cat),
		Body_:     gregor1.Body(body),
		Dtime_:    dtime,
	}
	return creation, nil
}

func FormMessageForDismissItem(ctx context.Context, uid gregor1.UID, id gregor.MsgID) (gregor.Message, error) {
	dismissal, err := TemplateMessage(uid)
	if err != nil {
		return nil, err
	}
	dismissal.Ibm_.StateUpdate_.Dismissal_ = &gregor1.Dismissal{
		MsgIDs_: []gregor1.MsgID{gregor1.MsgID(id.Bytes())},
	}
	return dismissal, nil
}
