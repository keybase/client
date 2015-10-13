package libkb

import (
	"encoding/base64"
	"io"
	"time"

	"github.com/keybase/client/go/kex2"
)

// KexRouter implements the kex2.MessageRouter interface.
type KexRouter struct {
	postEOF bool // true after Post called with nil msg
	getEOF  bool // true after Get receives an empty message
	Contextified
}

// NewKexRouter creates a contextified KexRouter.
func NewKexRouter(g *GlobalContext) *KexRouter {
	return &KexRouter{Contextified: NewContextified(g)}
}

// Post implements Post in the kex2.MessageRouter interface.
func (k *KexRouter) Post(sessID kex2.SessionID, sender kex2.DeviceID, seqno kex2.Seqno, msg []byte) (err error) {
	k.G().Log.Debug("+ KexRouter.Post(%x, %x, %d, msg)", sessID, sender, seqno)
	defer func() {
		k.G().Log.Debug("- KexRouter.Post(%x, %x, %d) -> %s", sessID, sender, seqno, ErrToOk(err))
	}()

	// once an EOF is received, then the connection is closed and no more messages can be sent:
	if k.postEOF {
		err = io.EOF
		return err
	}

	_, err = k.G().API.Post(APIArg{
		Endpoint: "kex2/send",
		Args: HTTPArgs{
			"I":      HexArg(sessID[:]),
			"sender": HexArg(sender[:]),
			"seqno":  I{Val: int(seqno)},
			"msg":    B64Arg(msg),
		},
		Contextified: NewContextified(k.G()),
	})

	// a nil message signals EOF.
	if msg == nil {
		k.postEOF = true
	}

	return err
}

// Get implements Get in the kex2.MessageRouter interface.
func (k *KexRouter) Get(sessID kex2.SessionID, receiver kex2.DeviceID, low kex2.Seqno, poll time.Duration) (msgs [][]byte, err error) {
	k.G().Log.Debug("+ KexRouter.Get(%x, %x, %d, %s)", sessID, receiver, low, poll)
	defer func() {
		k.G().Log.Debug("- KexRouter.Get(%x, %x, %d, %s) -> %s (messages: %d)", sessID, receiver, low, poll, ErrToOk(err), len(msgs))
	}()

	// if previously received EOF, then connection is closed.  Short-circuit and return EOF.
	if k.getEOF {
		err = io.EOF
		return nil, err
	}

	arg := APIArg{
		Endpoint: "kex2/receive",
		Args: HTTPArgs{
			"I":        HexArg(sessID[:]),
			"receiver": HexArg(receiver[:]),
			"low":      I{Val: int(low)},
			"poll":     I{Val: int(poll / time.Millisecond)},
		},
		Contextified: NewContextified(k.G()),
	}

	var j struct {
		Msgs []struct {
			Msg string `json:"msg"`
		} `json:"msgs"`
		Status struct {
			Code int    `json:"code"`
			Name string `json:"name"`
			Desc string `json:"desc"`
		}
	}
	if err = k.G().API.GetDecode(arg, &j); err != nil {
		return nil, err
	}
	if j.Status.Code != SCOk {
		return nil, AppStatusError{Code: j.Status.Code, Name: j.Status.Name, Desc: j.Status.Desc}
	}

	for _, m := range j.Msgs {
		if len(m.Msg) == 0 {
			// empty message signals EOF.
			k.getEOF = true
			if len(msgs) > 0 {
				// received some messages before EOF, so return those
				return msgs, nil
			}
			// just EOF, so return EOF.
			return nil, io.EOF
		}
		dec, err := base64.StdEncoding.DecodeString(m.Msg)
		if err != nil {
			return nil, err
		}
		msgs = append(msgs, dec)
	}

	return msgs, nil
}
