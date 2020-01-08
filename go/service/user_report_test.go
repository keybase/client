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

	callsToPull int
}

func (s *mockConvSource) Pull(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, reason chat1.GetThreadReason, query *chat1.GetThreadQuery,
	pagination *chat1.Pagination) (thread chat1.ThreadView, err error) {

	s.callsToPull++
	return chat1.ThreadView{
		Pagination: &chat1.Pagination{},
	}, nil
}

func TestPullTranscript(t *testing.T) {
	tc := libkb.SetupTest(t, "transcript", 3)
	defer tc.Cleanup()

	offender, err := kbtest.CreateAndSignupFakeUser("reps", tc.G)
	require.NoError(t, err)

	_, err = kbtest.CreateAndSignupFakeUser("reps", tc.G)
	require.NoError(t, err)

	cs := &mockConvSource{}
	chatG := &globals.ChatContext{
		ConvSource: cs,
	}

	testConvID := "0000fb1d870bfa7d669fb5d12a349fca394590f64184ac912813ab1937dc9031"
	userHandler := NewUserHandler(nil, tc.G, chatG, nil)
	err = userHandler.ReportUser(context.Background(), keybase1.ReportUserArg{
		Username:          offender.Username,
		ConvID:            &testConvID,
		IncludeTranscript: true,
		Comment:           "Coming from user_report_test.go",
	})
	require.NoError(t, err)
	require.Greater(t, cs.callsToPull, 0)
}
