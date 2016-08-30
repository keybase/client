package service

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
)

// RekeyLogHandler is a gregor inband message handler that logs
// all kbfs_tlf_rekey_needed items.
type RekeyLogHandler struct {
	libkb.Contextified
}

var _ libkb.GregorInBandMessageHandler = (*RekeyLogHandler)(nil)

func newRekeyLogHandler(g *libkb.GlobalContext) *RekeyLogHandler {
	return &RekeyLogHandler{
		Contextified: libkb.NewContextified(g),
	}
}

func (r *RekeyLogHandler) Create(ctx context.Context, cli gregor1.IncomingInterface, category string, item gregor.Item) (bool, error) {
	switch category {
	case "kbfs_tlf_rekey_needed":
		r.log(category, item)
		return true, nil
	default:
		return false, nil
	}
}

func (r *RekeyLogHandler) Dismiss(ctx context.Context, cli gregor1.IncomingInterface, category string, item gregor.Item) (bool, error) {
	return false, nil
}

func (r *RekeyLogHandler) IsAlive() bool {
	return true
}

func (r *RekeyLogHandler) Name() string {
	return "RekeyLogHandler"
}

func (r *RekeyLogHandler) timeOrOffsetString(t gregor.TimeOrOffset) string {
	if t == nil {
		return "[empty]"
	}
	if t.Time() != nil {
		return fmt.Sprintf("time: %s", t.Time())
	}
	if t.Offset() != nil {
		return fmt.Sprintf("offset: %s", t.Offset())
	}
	return "[empty]"
}

func (r *RekeyLogHandler) log(category string, item gregor.Item) {
	md := item.Metadata()
	r.G().Log.Debug("RekeyLogHandler: %s item message metadata: uid = %s, msg id = %s, ctime = %s, device = %s, inband type = %d", category, md.UID(), md.MsgID(), md.CTime(), md.DeviceID(), md.InBandMsgType())
	r.G().Log.Debug("RekeyLogHandler: %s item dtime = %s, remind times = %v", category, r.timeOrOffsetString(item.DTime()), item.RemindTimes())
	r.G().Log.Debug("RekeyLogHandler: %s item body: %s", category, item.Body())
}
