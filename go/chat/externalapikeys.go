package chat

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
)

type RemoteExternalAPIKeySource struct {
	globals.Contextified
	utils.DebugLabeler

	ri func() chat1.RemoteInterface
}

func NewRemoteExternalAPIKeySource(g *globals.Context, ri func() chat1.RemoteInterface) *RemoteExternalAPIKeySource {
	return &RemoteExternalAPIKeySource{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "RemoteExternalAPIKeySource", false),
		ri:           ri,
	}
}

func (r *RemoteExternalAPIKeySource) GetKey(ctx context.Context, typ chat1.ExternalAPIKeyTyp) (res chat1.ExternalAPIKey, err error) {
	defer r.Trace(ctx, func() error { return err }, "GetKey")()
	keys, err := r.ri().GetExternalAPIKeys(ctx, []chat1.ExternalAPIKeyTyp{typ})
	if err != nil {
		return res, err
	}
	if len(keys) != 1 {
		return res, fmt.Errorf("wrong number of keys returned: %d", len(keys))
	}
	rtyp, err := keys[0].Typ()
	if err != nil {
		return res, err
	}
	if rtyp != typ {
		return res, fmt.Errorf("server returned wrong key: %v != %v", typ, rtyp)
	}
	return keys[0], nil
}

func (r *RemoteExternalAPIKeySource) GetAllKeys(ctx context.Context) (res []chat1.ExternalAPIKey, err error) {
	defer r.Trace(ctx, func() error { return err }, "GetAllKeys")()
	return r.ri().GetExternalAPIKeys(ctx, nil)
}
