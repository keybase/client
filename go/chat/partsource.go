package chat

import (
	"context"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/gregor1"
)

type CachingParticipantSource struct {
	globals.Contextified
	utils.DebugLabeler
}

var _ types.ParticipantSource = (*CachingParticipantSource)(nil)

func NewCachingParticipantSource(g *globals.Context) *CachingParticipantSource {
	return &CachingParticipantSource{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "CachingParticipantSource", false),
	}
}

func (s *CachingParticipantSource) Get(ctx context.Context, conv types.RemoteConversation) (res []gregor1.UID, err error) {
	defer s.Trace(ctx, func() error { return err }, "Get")()
	return res, nil
}
