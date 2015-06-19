package kex

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/keybase/client/go/libkb"
)

// see issue 472
func (r *Receiver) brokenGet() (MsgList, error) {
	libkb.G.Log.Debug("get: {dir: %d, seqno: %d, w = %s}", r.direction, r.seqno, r.secret.WeakID())

	body := `{"status":{"code":202,"desc":"Login required for this resource, you.","name":"BAD_SESSION"}}`
	var j struct {
		Msgs   MsgList `json:"msgs"`
		Status struct {
			Code int    `json:"code"`
			Name string `json:"name"`
			Desc string `json:"desc"`
		}
	}
	dec := json.NewDecoder(strings.NewReader(body))
	if err := dec.Decode(&j); err != nil {
		return nil, err
	}
	if j.Status.Code != libkb.SCOk {
		return nil, libkb.AppStatusError{Code: j.Status.Code, Name: j.Status.Name, Desc: j.Status.Desc}
	}

	fmt.Printf("json: %+v\n", j)

	return j.Msgs, nil
}
