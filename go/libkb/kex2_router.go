// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"encoding/base64"
	"time"

	"github.com/keybase/client/go/kex2"
)

// KexRouter implements the kex2.MessageRouter interface.
type KexRouter struct {
	MetaContextified
}

// NewKexRouter creates a contextified KexRouter.
func NewKexRouter(m MetaContext) *KexRouter {
	return &KexRouter{
		MetaContextified: NewMetaContextified(m),
	}
}

// Post implements Post in the kex2.MessageRouter interface.
func (k *KexRouter) Post(sessID kex2.SessionID, sender kex2.DeviceID, seqno kex2.Seqno, msg []byte) (err error) {
	mctx := k.M().WithLogTag("KEXR")
	mctx.Debug("+ KexRouter.Post(%x, %x, %d, ...)", sessID, sender, seqno)
	defer func() {
		mctx.Debug("- KexRouter.Post(%x, %x, %d) -> %s", sessID, sender, seqno, ErrToOk(err))
	}()

	arg := APIArg{
		Endpoint: "kex2/send",
		Args: HTTPArgs{
			"I":      HexArg(sessID[:]),
			"sender": HexArg(sender[:]),
			"seqno":  I{Val: int(seqno)},
			"msg":    B64Arg(msg),
		},
	}
	mctx = mctx.BackgroundWithLogTags()
	kexAPITimeout(&arg, time.Second*5)
	_, err = mctx.G().API.Post(mctx, arg)

	return err
}

type kexResp struct {
	Msgs []struct {
		Msg string `json:"msg"`
	} `json:"msgs"`
	Status AppStatus `json:"status"`
}

func (k *kexResp) GetAppStatus() *AppStatus {
	return &k.Status
}

func kexAPITimeout(arg *APIArg, initial time.Duration) {
	arg.RetryCount = 5
	arg.RetryMultiplier = 1.0
	initialMin := time.Second * 3
	if initial < initialMin {
		initial = initialMin
	}
	arg.InitialTimeout = initial
}

// Get implements Get in the kex2.MessageRouter interface.
func (k *KexRouter) Get(sessID kex2.SessionID, receiver kex2.DeviceID, low kex2.Seqno, poll time.Duration) (msgs [][]byte, err error) {
	mctx := k.M().WithLogTag("KEXR")
	mctx.Debug("+ KexRouter.Get(%x, %x, %d, %s)", sessID, receiver, low, poll)
	defer func() {
		mctx.Debug("- KexRouter.Get(%x, %x, %d, %s) -> %s (messages: %d)", sessID, receiver, low, poll, ErrToOk(err), len(msgs))
	}()

	if poll > HTTPPollMaximum {
		poll = HTTPPollMaximum
	}

	arg := APIArg{
		Endpoint: "kex2/receive",
		Args: HTTPArgs{
			"I":        HexArg(sessID[:]),
			"receiver": HexArg(receiver[:]),
			"low":      I{Val: int(low)},
			"poll":     I{Val: int(poll / time.Millisecond)},
		},
	}
	kexAPITimeout(&arg, 2*poll)
	var j kexResp

	if err = mctx.G().API.GetDecode(mctx.BackgroundWithLogTags(), arg, &j); err != nil {
		return nil, err
	}
	if j.Status.Code != SCOk {
		return nil, AppStatusError{Code: j.Status.Code, Name: j.Status.Name, Desc: j.Status.Desc}
	}

	for _, m := range j.Msgs {
		dec, err := base64.StdEncoding.DecodeString(m.Msg)
		if err != nil {
			return nil, err
		}
		msgs = append(msgs, dec)
	}

	return msgs, nil
}
