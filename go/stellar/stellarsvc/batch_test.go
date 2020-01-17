package stellarsvc

import (
	"context"
	"fmt"
	"sync"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar"
	"github.com/keybase/stellarnet"
	"github.com/stretchr/testify/require"
)

// TestPrepareBatchRelays checks that a PrepareBatchPayments
// with a destination username that is a valid user but someone who
// doesn't have a wallet will succeed and create a relay payment.
func TestPrepareBatchRelays(t *testing.T) {
	tc, cleanup := setupDesktopTest(t)
	defer cleanup()
	require.NotNil(t, tc.Srv.walletState)

	tcw, cleanupw := setupDesktopTest(t)
	defer cleanupw()

	mctx := libkb.NewMetaContext(context.Background(), tc.G)

	acceptDisclaimer(tc)
	acceptDisclaimer(tcw)
	payments := []stellar1.BatchPaymentArg{
		{Recipient: "t_rebecca", Amount: "3"},
		{Recipient: tcw.Fu.Username, Amount: "2"},
	}
	batchID, err := libkb.RandHexString("", 8)
	require.NoError(t, err)

	_, senderAccountBundle, err := stellar.LookupSenderPrimary(mctx)
	require.NoError(t, err)
	senderSeed, err := stellarnet.NewSeedStr(senderAccountBundle.Signers[0].SecureNoLogString())
	require.NoError(t, err)

	prepared, unlock, err := stellar.PrepareBatchPayments(mctx, tc.Srv.walletState, senderSeed, payments, batchID)
	defer unlock()
	require.NoError(t, err)
	require.Len(t, prepared, 2)
	for i, p := range prepared {
		t.Logf("result %d: %+v", i, p)

		switch p.Username.String() {
		case "t_rebecca":
			require.Nil(t, p.Direct)
			require.NotNil(t, p.Relay)
			require.True(t, p.Relay.QuickReturn)
			require.Nil(t, p.Error)
			require.NotEmpty(t, p.Seqno)
			require.NotEmpty(t, p.TxID)
			require.Equal(t, batchID, p.Relay.BatchID)
		case tcw.Fu.Username:
			require.NotNil(t, p.Direct)
			require.Nil(t, p.Relay)
			require.True(t, p.Direct.QuickReturn)
			require.Nil(t, p.Error)
			require.NotEmpty(t, p.Seqno)
			require.NotEmpty(t, p.TxID)
			require.Equal(t, batchID, p.Direct.BatchID)
		default:
			t.Fatalf("unknown username in result: %s", p.Username)
		}
	}
	if prepared[0].Seqno > prepared[1].Seqno {
		t.Errorf("prepared sort failed (seqnos out of order)")
	}
}

// TestPrepareBatchLowAmounts checks that a PrepareBatchPayments
// with low amounts will return errors quickly.
func TestPrepareBatchLowAmounts(t *testing.T) {
	tc, cleanup := setupDesktopTest(t)
	defer cleanup()
	require.NotNil(t, tc.Srv.walletState)

	tcw, cleanupw := setupDesktopTest(t)
	defer cleanupw()

	mctx := libkb.NewMetaContext(context.Background(), tc.G)

	acceptDisclaimer(tc)
	acceptDisclaimer(tcw)
	payments := []stellar1.BatchPaymentArg{
		{Recipient: "t_rebecca", Amount: "1"},
		{Recipient: tcw.Fu.Username, Amount: "0.2"},
	}
	batchID, err := libkb.RandHexString("", 8)
	require.NoError(t, err)

	_, senderAccountBundle, err := stellar.LookupSenderPrimary(mctx)
	require.NoError(t, err)
	senderSeed, err := stellarnet.NewSeedStr(senderAccountBundle.Signers[0].SecureNoLogString())
	require.NoError(t, err)

	prepared, unlock, err := stellar.PrepareBatchPayments(mctx, tc.Srv.walletState, senderSeed, payments, batchID)
	defer unlock()
	require.NoError(t, err)
	require.Len(t, prepared, 2)
	for i, p := range prepared {
		t.Logf("result %d: %+v", i, p)

		switch p.Username.String() {
		case "t_rebecca":
			require.Nil(t, p.Direct)
			require.Nil(t, p.Relay)
			require.Error(t, p.Error)
			require.Empty(t, p.Seqno)
			require.Empty(t, p.TxID)
		case tcw.Fu.Username:
			require.Nil(t, p.Direct)
			require.Nil(t, p.Relay)
			require.Error(t, p.Error)
			require.Empty(t, p.Seqno)
			require.Empty(t, p.TxID)
		default:
			t.Fatalf("unknown username in result: %s", p.Username)
		}
	}
}

// TestBatchMultiDirect does a batch payment with the multi flag on
// and ensures that it was successful and that the appropriate
// chat messages were sent.  All the recipients have stellar accounts.
func TestBatchMultiDirect(t *testing.T) {
	// sender test context
	tc, cleanup := setupDesktopTest(t)
	defer cleanup()
	acceptDisclaimer(tc)

	chatHelper := &testChatHelper{}
	tc.G.ChatHelper = chatHelper

	// recipient test contexts
	const numRecips = 3
	recipTC := make([]*TestContext, numRecips)
	for i := 0; i < numRecips; i++ {
		var c func()
		recipTC[i], c = setupDesktopTest(t)
		defer c()
		acceptDisclaimer(recipTC[i])
	}

	// make the batch payment arg
	arg := stellar1.BatchLocalArg{
		BatchID:     "testbatchmulti",
		TimeoutSecs: 10,
		UseMulti:    true,
		Payments:    make([]stellar1.BatchPaymentArg, numRecips),
	}
	for i, rc := range recipTC {
		arg.Payments[i] = stellar1.BatchPaymentArg{
			Recipient: rc.Fu.Username,
			Amount:    "3.198",
			Message:   "batch payment message",
		}
	}

	res, err := tc.Srv.BatchLocal(context.Background(), arg)
	require.NoError(t, err)
	require.Len(t, res.Payments, numRecips)
	for i, p := range res.Payments {
		if p.Status != stellar1.PaymentStatus_COMPLETED {
			if p.Status == stellar1.PaymentStatus_ERROR {
				t.Logf("payment %d error: %s (%d)", i, p.Error.Message, p.Error.Code)
			}
			t.Errorf("payment %d not complete: %+v", i, p)
		}

		var msg *paymentMsg
		convName := fmt.Sprintf("%s,%s", tc.Fu.Username, p.Username)
		for _, m := range chatHelper.paymentMsgs {
			if m.ConvName == convName {
				msg = &m
			}
		}
		if msg == nil {
			t.Errorf("payment %d no chat message found: %+v", i, p)
		}
		if msg.PaymentID != stellar1.PaymentID(p.TxID) {
			t.Errorf("payment %d chat msg tx id: %q, expected %q", i, msg.PaymentID, p.TxID)
		}
	}
}

type paymentMsg struct {
	ConvName  string
	PaymentID stellar1.PaymentID
}

// testChatHelper is used to see if chat messages are sent.
type testChatHelper struct {
	libkb.ChatHelper

	paymentMsgs []paymentMsg

	sync.Mutex
}

func (tch *testChatHelper) SendMsgByName(ctx context.Context, name string, topicName *string,
	membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, body chat1.MessageBody,
	msgType chat1.MessageType) error {
	tch.Lock()
	defer tch.Unlock()
	if msgType == chat1.MessageType_SENDPAYMENT {
		tch.paymentMsgs = append(tch.paymentMsgs, paymentMsg{ConvName: name, PaymentID: body.Sendpayment().PaymentID})
	}
	return nil
}

func (tch *testChatHelper) SendMsgByNameNonblock(ctx context.Context, name string, topicName *string, membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, body chat1.MessageBody, msgType chat1.MessageType, outboxID *chat1.OutboxID) (chat1.OutboxID, error) {
	tch.Lock()
	defer tch.Unlock()
	if msgType == chat1.MessageType_SENDPAYMENT {
		tch.paymentMsgs = append(tch.paymentMsgs, paymentMsg{ConvName: name, PaymentID: body.Sendpayment().PaymentID})
	}

	return nil, nil
}
