package wallet

import (
	"context"
	"errors"
	"testing"

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

type mockInboxSource struct {
	types.InboxSource
	membersTypFn func() chat1.ConversationMembersType
	partsFn      func() []string
}

func (m *mockInboxSource) Read(ctx context.Context, uid gregor1.UID,
	localizeTyp types.ConversationLocalizerTyp,
	dataSource types.InboxSourceDataSourceTyp, maxLocalize *int, query *chat1.GetInboxLocalQuery,
	p *chat1.Pagination) (types.Inbox, chan types.AsyncInboxResult, error) {
	parts := m.partsFn()
	var convParts []chat1.ConversationLocalParticipant
	for _, p := range parts {
		convParts = append(convParts, chat1.ConversationLocalParticipant{
			Username: p,
		})
	}
	return types.Inbox{
		Convs: []chat1.ConversationLocal{chat1.ConversationLocal{
			Info: chat1.ConversationInfoLocal{
				MembersType:  m.membersTypFn(),
				Participants: convParts,
			},
		}},
	}, nil, nil
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

type mockUpakLoader struct {
	libkb.UPAKLoader
	usernameFn func(gregor1.UID) string
	usernames  map[string]string
}

func newMockUpakLoader() *mockUpakLoader {
	return &mockUpakLoader{
		usernames: make(map[string]string),
	}
}

func (m *mockUpakLoader) addUser(uid gregor1.UID, username string) {
	m.usernames[uid.String()] = username
}

func (m *mockUpakLoader) getUser(uid gregor1.UID) string {
	return m.usernames[uid.String()]
}

func (m *mockUpakLoader) LookupUsername(ctx context.Context, uid keybase1.UID) (libkb.NormalizedUsername, error) {
	return libkb.NewNormalizedUsername(m.usernames[uid.String()]), nil
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
	mu := newMockUpakLoader()
	mu.addUser(mikeUID, "mikem")
	mu.addUser(patrickUID, "patrick")
	mu.addUser(maxUID, "max")
	tc.G.SetStellar(&ms)
	tc.G.SetUPAKLoader(mu)
	g := globals.NewContext(tc.G, &globals.ChatContext{
		InboxSource: &mi,
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
	mikePatrickFn := func() []string {
		return []string{"mikem", "patrick"}
	}
	allFn := func() []string {
		return []string{"mikem", "patrick", "max"}
	}
	type paymentRes struct {
		resultTyp chat1.TextPaymentResultTyp
		text      string
	}
	testCase := func(body string, expected []paymentRes, senderUID gregor1.UID,
		partsFn func() []string, typFn func() chat1.ConversationMembersType,
		miniFn func([]libkb.MiniChatPayment) ([]libkb.MiniChatPaymentResult, error)) {
		mi.membersTypFn = typFn
		mi.partsFn = partsFn
		ms.miniFn = miniFn
		parsedPayments := sender.ParsePayments(context.TODO(), senderUID, convID, body)
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
	testCase("+1XLM", []paymentRes{paymentRes{
		resultTyp: chat1.TextPaymentResultTyp_SENT,
		text:      "+1XLM",
	}}, mikeUID, mikePatrickFn, nativeFn, successFn(nil, patrickUID))
	testCase("+1XLM", []paymentRes{paymentRes{
		resultTyp: chat1.TextPaymentResultTyp_ERROR,
		text:      "+1XLM",
	}}, mikeUID, mikePatrickFn, nativeFn, successFn(errors.New("NOOOO"), patrickUID))
	testCase("+1XLM", nil, mikeUID, allFn, nativeFn, successFn(nil))
	testCase("+1XLM@patrick", []paymentRes{paymentRes{
		resultTyp: chat1.TextPaymentResultTyp_SENT,
		text:      "+1XLM@patrick",
	}}, mikeUID, allFn, nativeFn, successFn(nil, patrickUID))
	testCase("+1XLM@patrick and also +10USD@max", []paymentRes{paymentRes{
		resultTyp: chat1.TextPaymentResultTyp_SENT,
		text:      "+1XLM@patrick",
	}, paymentRes{
		resultTyp: chat1.TextPaymentResultTyp_SENT,
		text:      "+10USD@max",
	}}, mikeUID, allFn, nativeFn, successFn(nil, patrickUID, maxUID))

	t.Logf("team successes")
	testCase("+1XLM", nil, mikeUID, mikePatrickFn, teamFn, successFn(nil))
	testCase("+1XLM@patrick", []paymentRes{paymentRes{
		resultTyp: chat1.TextPaymentResultTyp_SENT,
		text:      "+1XLM@patrick",
	}}, mikeUID, mikePatrickFn, teamFn, successFn(nil, patrickUID))
	testCase("+1XLM@patrick and also +10USD@max", []paymentRes{paymentRes{
		resultTyp: chat1.TextPaymentResultTyp_SENT,
		text:      "+1XLM@patrick",
	}, paymentRes{
		resultTyp: chat1.TextPaymentResultTyp_SENT,
		text:      "+10USD@max",
	}}, mikeUID, allFn, teamFn, successFn(nil, patrickUID, maxUID))
	testCase("+1XLM@patrick and also +10USD@max, and +10cad@karenm", []paymentRes{paymentRes{
		resultTyp: chat1.TextPaymentResultTyp_SENT,
		text:      "+1XLM@patrick",
	}, paymentRes{
		resultTyp: chat1.TextPaymentResultTyp_SENT,
		text:      "+10USD@max",
	}}, mikeUID, allFn, teamFn, successFn(nil, patrickUID, maxUID))

}
