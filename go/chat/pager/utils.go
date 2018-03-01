package pager

import (
	"github.com/keybase/client/go/protocol/chat1"
)

type pagerMsg struct {
	msgID chat1.MessageID
}

func (p pagerMsg) GetMessageID() chat1.MessageID {
	return p.msgID
}

func XlateMessageIDControlToPagination(control *chat1.MessageIDControl) (res *chat1.Pagination) {
	if control == nil {
		return res
	}
	pag := NewThreadPager()
	res = new(chat1.Pagination)
	res.Num = control.Num
	if control.Pivot != nil {
		pm := pagerMsg{msgID: *control.Pivot}
		var err error
		if control.Recent {
			res.Previous, err = pag.MakeIndex(pm)
		} else {
			res.Next, err = pag.MakeIndex(pm)
		}
		if err != nil {
			return nil
		}
	}
	return res
}
