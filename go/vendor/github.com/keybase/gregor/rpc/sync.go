package rpc

import (
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"github.com/keybase/gregor"
	"github.com/keybase/gregor/protocol/gregor1"
)

// Sync is used by both the main server, and functions mocking the main server. So
// factor it out into its own function here.
func Sync(sm gregor.StateMachine, log rpc.LogOutput, arg gregor1.SyncArg) (gregor1.SyncResult, error) {
	var res gregor1.SyncResult
	msgs, err := sm.InBandMessagesSince(arg.UID(), arg.DeviceID(), arg.CTime())
	if err != nil {
		return res, err
	}
	state, err := sm.State(arg.UID(), arg.DeviceID(), nil)
	if err != nil {
		return res, err
	}
	hash, err := state.Hash()
	if err != nil {
		return res, err
	}
	for _, msg := range msgs {
		if msg, ok := msg.(gregor1.InBandMessage); ok {
			res.Msgs = append(res.Msgs, msg)
		} else {
			log.Warning("Bad cast in serveSync (type=%T): %+v", msg)
		}
	}
	res.Hash = hash
	return res, nil
}
