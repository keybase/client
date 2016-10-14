package pager

import (
	"errors"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/go-codec/codec"
)

// inboxPagerFields is the info that gives a total ordering on the inbox
type InboxPagerFields struct {
	Mtime  gregor1.Time         `codec:"M"`
	ConvID chat1.ConversationID `codec:"C"`
}

// pager provides the getPage and makePage functions for implementing
// paging in the chat1 protocol
type Pager struct {
	codec codec.Handle
}

func NewPager() Pager {
	mh := codec.MsgpackHandle{WriteExt: true}
	return Pager{
		codec: &mh,
	}
}

func (p Pager) encode(input interface{}) ([]byte, error) {
	var data []byte
	enc := codec.NewEncoderBytes(&data, p.codec)
	if err := enc.Encode(input); err != nil {
		return nil, err
	}
	return data, nil
}

func (p Pager) decode(data []byte, res interface{}) error {
	dec := codec.NewDecoderBytes(data, p.codec)
	err := dec.Decode(res)
	return err
}

func (p Pager) GetPage(getcond func(bool) string, page *chat1.Pagination,
	pivot interface{}) (string, bool, error) {

	var dat []byte
	var cond string
	var prev bool

	// Set the query condition depending on what direction we are looking
	if len(page.Next) > 0 {
		cond = getcond(false)
		dat = page.Next
	} else if len(page.Previous) > 0 {
		cond = getcond(true)
		dat = page.Previous
		prev = true
	} else {
		return "", false, nil
	}

	if err := p.decode(dat, pivot); err != nil {
		return "", false, err
	}

	return cond, prev, nil
}

func (p Pager) MakePage(length, reqed int, next interface{}, prev interface{}) (*chat1.Pagination, error) {
	prevEncoded, err := p.encode(prev)
	if err != nil {
		return nil, err
	}
	nextEncoded, err := p.encode(next)
	if err != nil {
		return nil, err
	}

	return &chat1.Pagination{
		Num:      length,
		Next:     nextEncoded,
		Previous: prevEncoded,
		Last:     (length < reqed),
	}, nil
}

// inboxPager provides a convenient interface to pager for the inbox
// use case
type InboxPager struct {
	Pager
}

func NewInboxPager() InboxPager {
	return InboxPager{Pager: NewPager()}
}

func (p InboxPager) MakePage(res []chat1.Conversation, reqed int) (*chat1.Pagination, error) {
	if len(res) == 0 {
		return &chat1.Pagination{Num: 0, Last: true}, nil
	}

	if res[0].ReaderInfo == nil || res[len(res)-1].ReaderInfo == nil {
		return nil, errors.New("need reader info to page conversations")
	}

	// Get first and last message IDs to encode in the result
	prevPF := InboxPagerFields{Mtime: res[0].ReaderInfo.Mtime, ConvID: res[0].Metadata.ConversationID}
	nextPF := InboxPagerFields{
		Mtime:  res[len(res)-1].ReaderInfo.Mtime,
		ConvID: res[len(res)-1].Metadata.ConversationID,
	}

	return p.Pager.MakePage(len(res), reqed, nextPF, prevPF)
}

// threadPager provides a covenient interface to pager for the thread use case
type ThreadPager struct {
	Pager
}

type Message interface {
	GetMessageID() chat1.MessageID
}

func NewThreadPager() ThreadPager {
	return ThreadPager{Pager: NewPager()}
}

func (p ThreadPager) MakePage(res []Message, reqed int) (*chat1.Pagination, error) {
	if len(res) == 0 {
		return &chat1.Pagination{Num: 0}, nil
	}

	// Get first and last message IDs to encode in the result
	prevMsgID := res[0].GetMessageID()
	nextMsgID := res[len(res)-1].GetMessageID()

	return p.Pager.MakePage(len(res), reqed, nextMsgID, prevMsgID)
}

func (p ThreadPager) MakeIndex(msg Message) ([]byte, error) {
	return p.encode(msg.GetMessageID())
}
