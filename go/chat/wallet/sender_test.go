package wallet

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/stretchr/testify/require"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/libkb"
)

type mockUIDMapper struct {
	libkb.UIDMapper
	usernames map[string]string
}

func newMockUIDMapper() *mockUIDMapper {
	return &mockUIDMapper{
		usernames: make(map[string]string),
	}
}

func (m *mockUIDMapper) addUser(uid gregor1.UID, username string) {
	m.usernames[uid.String()] = username
}

func (m *mockUIDMapper) getUser(uid gregor1.UID) string {
	return m.usernames[uid.String()]
}

func (m *mockUIDMapper) MapUIDsToUsernamePackages(ctx context.Context, g libkb.UIDMapperContext,
	uids []keybase1.UID, fullNameFreshness, networkTimeBudget time.Duration,
	forceNetworkForFullNames bool) (res []libkb.UsernamePackage, err error) {
	for _, uid := range uids {
		res = append(res, libkb.UsernamePackage{
			NormalizedUsername: libkb.NewNormalizedUsername(m.getUser(uid.ToBytes())),
		})
	}
	return res, nil
}

type mockParticipantsSource struct {
	types.ParticipantSource
	partsFn func() []gregor1.UID
}

func (m *mockParticipantsSource) Get(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	dataSource types.InboxSourceDataSourceTyp) ([]gregor1.UID, error) {
	return m.partsFn(), nil
}

type mockInboxSource struct {
	types.InboxSource
	membersTypFn func() chat1.ConversationMembersType
	tlfNameFn    func() string
}

func (m *mockInboxSource) ReadUnverified(ctx context.Context, uid gregor1.UID,
	dataSource types.InboxSourceDataSourceTyp, query *chat1.GetInboxQuery) (types.Inbox, error) {
	return types.Inbox{
		ConvsUnverified: []types.RemoteConversation{{
			Conv: chat1.Conversation{
				Metadata: chat1.ConversationMetadata{
					ConversationID: query.ConvIDs[0],
					MembersType:    m.membersTypFn(),
				},
			},
			LocalMetadata: &types.RemoteConversationMetadata{
				Name: m.tlfNameFn(),
			},
		}},
	}, nil
}

type mockStellar struct {
	libkb.Stellar
	miniFn func([]libkb.MiniChatPayment) ([]libkb.MiniChatPaymentResult, error)
}

func (m *mockStellar) SendMiniChatPayments(mctx libkb.MetaContext, convID chat1.ConversationID, payments []libkb.MiniChatPayment) (res []libkb.MiniChatPaymentResult, err error) {
	return m.miniFn(payments)
}

func (m *mockStellar) KnownCurrencyCodeInstant(context.Context, string) (bool, bool) {
	return false, false
}

func TestStellarSender(t *testing.T) {
	tc := externalstest.SetupTest(t, "stellarsender", 0)
	defer tc.Cleanup()

	mikeUID := gregor1.UID([]byte{0, 1})
	patrickUID := gregor1.UID([]byte{0, 2})
	maxUID := gregor1.UID([]byte{0, 4})
	convID := chat1.ConversationID([]byte{0, 3})
	ms := mockStellar{}
	mi := mockInboxSource{}
	mp := mockParticipantsSource{}
	mu := newMockUIDMapper()
	mu.addUser(mikeUID, "mikem")
	mu.addUser(patrickUID, "patrick")
	mu.addUser(maxUID, "max")
	tc.G.SetStellar(&ms)
	tc.G.SetUIDMapper(mu)
	g := globals.NewContext(tc.G, &globals.ChatContext{
		InboxSource:        &mi,
		ParticipantsSource: &mp,
	})
	sender := NewSender(g)
	successFn := func(incErr error, uids ...gregor1.UID) func(payments []libkb.MiniChatPayment) ([]libkb.MiniChatPaymentResult, error) {
		return func(payments []libkb.MiniChatPayment) (res []libkb.MiniChatPaymentResult, err error) {
			for index, p := range payments {
				require.Equal(t, p.Username.String(), mu.getUser(uids[index]))
				res = append(res, libkb.MiniChatPaymentResult{
					Username:  p.Username,
					Error:     incErr,
					PaymentID: stellar1.PaymentID("MIKE"),
				})
			}
			return res, nil
		}
	}
	nativeFn := func() chat1.ConversationMembersType {
		return chat1.ConversationMembersType_IMPTEAMNATIVE
	}
	teamFn := func() chat1.ConversationMembersType {
		return chat1.ConversationMembersType_TEAM
	}
	mikePatrickFn := func() []gregor1.UID {
		return []gregor1.UID{mikeUID, patrickUID}
	}
	mikePatrickNameFn := func() string {
		return "mikem,patrick"
	}
	allFn := func() []gregor1.UID {
		return []gregor1.UID{mikeUID, patrickUID, maxUID}
	}
	allNameFn := func() string {
		return "mikem,patrick,max"
	}
	teamNameFn := func() string {
		return "team"
	}
	type paymentRes struct {
		resultTyp chat1.TextPaymentResultTyp
		text      string
	}
	testCase := func(body string, expected []paymentRes, senderUID gregor1.UID,
		partsFn func() []gregor1.UID, typFn func() chat1.ConversationMembersType,
		miniFn func([]libkb.MiniChatPayment) ([]libkb.MiniChatPaymentResult, error),
		nameFn func() string) {
		mi.membersTypFn = typFn
		mi.tlfNameFn = nameFn
		mp.partsFn = partsFn
		ms.miniFn = miniFn
		parsedPayments := sender.ParsePayments(context.TODO(), senderUID, convID, body, nil)
		res, err := sender.SendPayments(context.TODO(), convID, parsedPayments)
		require.NoError(t, err)
		require.Equal(t, len(expected), len(res))
		for index, r := range expected {
			require.Equal(t, r.text, res[index].PaymentText)
			typ, err := res[0].Result.ResultTyp()
			require.NoError(t, err)
			require.Equal(t, r.resultTyp, typ)
		}
	}

	t.Logf("imp team")
	testCase("+1XLM", []paymentRes{{
		resultTyp: chat1.TextPaymentResultTyp_SENT,
		text:      "+1XLM",
	}}, mikeUID, mikePatrickFn, nativeFn, successFn(nil, patrickUID), mikePatrickNameFn)
	testCase("+1XLM", []paymentRes{{
		resultTyp: chat1.TextPaymentResultTyp_ERROR,
		text:      "+1XLM",
	}}, mikeUID, mikePatrickFn, nativeFn, successFn(errors.New("NOOOO"), patrickUID), mikePatrickNameFn)
	testCase("+1XLM", nil, mikeUID, allFn, nativeFn, successFn(nil), allNameFn)
	testCase("+1XLM@patrick", []paymentRes{{
		resultTyp: chat1.TextPaymentResultTyp_SENT,
		text:      "+1XLM@patrick",
	}}, mikeUID, allFn, nativeFn, successFn(nil, patrickUID), allNameFn)
	testCase("+1XLM@patrick and also +10USD@max", []paymentRes{{
		resultTyp: chat1.TextPaymentResultTyp_SENT,
		text:      "+1XLM@patrick",
	}, {
		resultTyp: chat1.TextPaymentResultTyp_SENT,
		text:      "+10USD@max",
	}}, mikeUID, allFn, nativeFn, successFn(nil, patrickUID, maxUID), allNameFn)

	t.Logf("team successes")
	testCase("+1XLM", nil, mikeUID, mikePatrickFn, teamFn, successFn(nil), teamNameFn)
	testCase("+1XLM@patrick", []paymentRes{{
		resultTyp: chat1.TextPaymentResultTyp_SENT,
		text:      "+1XLM@patrick",
	}}, mikeUID, mikePatrickFn, teamFn, successFn(nil, patrickUID), teamNameFn)
	testCase("+1XLM@patrick and also +10USD@max", []paymentRes{{
		resultTyp: chat1.TextPaymentResultTyp_SENT,
		text:      "+1XLM@patrick",
	}, {
		resultTyp: chat1.TextPaymentResultTyp_SENT,
		text:      "+10USD@max",
	}}, mikeUID, allFn, teamFn, successFn(nil, patrickUID, maxUID), teamNameFn)
	testCase("+1XLM@patrick and also +10USD@max, and +10cad@karenm", []paymentRes{{
		resultTyp: chat1.TextPaymentResultTyp_SENT,
		text:      "+1XLM@patrick",
	}, {
		resultTyp: chat1.TextPaymentResultTyp_SENT,
		text:      "+10USD@max",
	}}, mikeUID, allFn, teamFn, successFn(nil, patrickUID, maxUID), teamNameFn)

}
