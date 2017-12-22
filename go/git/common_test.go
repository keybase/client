package git

import (
	"testing"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"golang.org/x/net/context"
)

// Copied from the teams tests.
func SetupTest(tb testing.TB, name string, depth int) (tc libkb.TestContext) {
	tc = libkb.SetupTest(tb, name, depth+1)
	tc.G.SetServices(externals.GetServices())
	tc.G.ChatHelper = &mockChatHelper{}
	teams.ServiceInit(tc.G)
	return tc
}

func MockSentMessages(tc libkb.TestContext) []MockMessage {
	if tc.G.ChatHelper == nil {
		tc.T.Fatal("ChatHelper is nil")
	}
	mch, ok := tc.G.ChatHelper.(*mockChatHelper)
	if !ok {
		tc.T.Fatalf("ChatHelper isn't a mock: %T", tc.G.ChatHelper)
	}
	return mch.sentMessages
}

// MockMessage only supports what we're currently testing (system message for git push).
type MockMessage struct {
	name        string
	topicName   *string
	membersType chat1.ConversationMembersType
	ident       keybase1.TLFIdentifyBehavior
	body        chat1.MessageBody
	msgType     chat1.MessageType
}

type mockChatHelper struct {
	sentMessages []MockMessage
}

func (m *mockChatHelper) SendTextByID(ctx context.Context, convID chat1.ConversationID,
	trip chat1.ConversationIDTriple, tlfName string, text string) error {
	return nil
}
func (m *mockChatHelper) SendMsgByID(ctx context.Context, convID chat1.ConversationID,
	trip chat1.ConversationIDTriple, tlfName string, body chat1.MessageBody, msgType chat1.MessageType) error {
	return nil
}
func (m *mockChatHelper) SendTextByIDNonblock(ctx context.Context, convID chat1.ConversationID,
	trip chat1.ConversationIDTriple, tlfName string, text string) error {
	return nil
}
func (m *mockChatHelper) SendMsgByIDNonblock(ctx context.Context, convID chat1.ConversationID,
	trip chat1.ConversationIDTriple, tlfName string, body chat1.MessageBody, msgType chat1.MessageType) error {
	return nil
}
func (m *mockChatHelper) SendTextByName(ctx context.Context, name string, topicName *string,
	membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, text string) error {
	return nil
}
func (m *mockChatHelper) SendMsgByName(ctx context.Context, name string, topicName *string,
	membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, body chat1.MessageBody,
	msgType chat1.MessageType) error {
	m.sentMessages = append(m.sentMessages, MockMessage{
		name:        name,
		topicName:   topicName,
		membersType: membersType,
		ident:       ident,
		body:        body,
		msgType:     msgType,
	})
	return nil
}
func (m *mockChatHelper) SendTextByNameNonblock(ctx context.Context, name string, topicName *string,
	membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, text string) error {
	return nil
}
func (m *mockChatHelper) SendMsgByNameNonblock(ctx context.Context, name string, topicName *string,
	membersType chat1.ConversationMembersType, ident keybase1.TLFIdentifyBehavior, body chat1.MessageBody,
	msgType chat1.MessageType) error {
	return nil
}
