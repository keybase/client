package service

import (
	"context"
	"testing"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/stretchr/testify/require"
)

func TestChatSessionGatingProtocol(t *testing.T) {
	g := globals.NewContext(&libkb.GlobalContext{}, &globals.ChatContext{})
	called := false
	prot := ChatSessionGatingProtocol(g, rpc.Protocol{
		Name: "test",
		Methods: map[string]rpc.ServeHandlerDescription{
			"echo": {
				MakeArg: func() any { return new(int) },
				Handler: func(ctx context.Context, _ any) (any, error) {
					called = true
					require.False(t, globals.ChatSessionStale(ctx, g))
					return 1, nil
				},
			},
		},
	})

	g.BeginChatLogout()
	_, err := prot.Methods["echo"].Handler(context.Background(), nil)
	require.Error(t, err)
	_, ok := err.(libkb.LoginRequiredError)
	require.True(t, ok)
	require.False(t, called)

	g.MarkChatReady()
	_, err = prot.Methods["echo"].Handler(context.Background(), nil)
	require.NoError(t, err)
	require.True(t, called)
}
