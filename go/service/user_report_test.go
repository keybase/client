package service

import (
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/protocol/chat1"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/net/context"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

type mockConvSource struct {
	types.ConversationSource
	t           *testing.T
	callsToPull int
}

type reportTestAPIMock struct {
	libkb.API
	t    *testing.T
	args libkb.APIArg
}

func (n *reportTestAPIMock) Post(mctx libkb.MetaContext, arg libkb.APIArg) (*libkb.APIRes, error) {
	n.args = arg
	return nil, nil
}

func (s *mockConvSource) Pull(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, reason chat1.GetThreadReason, customRi func() chat1.RemoteInterface,
	query *chat1.GetThreadQuery, pagination *chat1.Pagination) (thread chat1.ThreadView, err error) {

	s.callsToPull++

	require.Greater(s.t, pagination.Num, 0)
	require.Len(s.t, pagination.Next, 0)
	require.NotNil(s.t, query)

	return chat1.ThreadView{
		Pagination: &chat1.Pagination{
			Last: true,
		},
	}, nil
}

func TestPullTranscript(t *testing.T) {
	tc := libkb.SetupTest(t, "transcript", 3)
	defer tc.Cleanup()

	offender, err := kbtest.CreateAndSignupFakeUser("reps", tc.G)
	require.NoError(t, err)

	_, err = kbtest.CreateAndSignupFakeUser("reps", tc.G)
	require.NoError(t, err)

	cs := &mockConvSource{t: t}
	chatG := &globals.ChatContext{
		ConvSource: cs,
	}

	randBytes, err := libkb.RandBytes(32)
	require.NoError(t, err)
	testConvID := chat1.ConversationID(randBytes).String()

	apiMock := &reportTestAPIMock{t: t}
	tc.G.API = apiMock

	userHandler := NewUserHandler(nil, tc.G, chatG, nil)
	err = userHandler.ReportUser(context.Background(), keybase1.ReportUserArg{
		Username:          offender.Username,
		ConvID:            &testConvID,
		IncludeTranscript: true,
		Comment:           "Coming from user_report_test.go",
	})
	require.NoError(t, err)

	require.Equal(t, "report/conversation", apiMock.args.Endpoint)
	require.Contains(t, apiMock.args.Args, "username")
	require.Equal(t, testConvID, apiMock.args.Args["conv_id"].String())
	require.Contains(t, apiMock.args.Args, "transcript")

	require.Greater(t, cs.callsToPull, 0)
}
