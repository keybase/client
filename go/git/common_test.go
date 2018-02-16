package git

import (
	"bytes"
	"fmt"
	"testing"

	"github.com/keybase/client/go/chat/utils"
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
	tc.G.ChatHelper = newMockChatHelper()
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
	convs        map[string]chat1.ConversationLocal
}

var _ libkb.ChatHelper = (*mockChatHelper)(nil)

func newMockChatHelper() *mockChatHelper {
	return &mockChatHelper{
		convs: make(map[string]chat1.ConversationLocal),
	}
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
	rb, err := libkb.RandBytes(10)
	if err != nil {
		return err
	}
	// use this to fake making channels...
	_, ok := m.convs[m.convKey(name, topicName)]
	if !ok {
		v := chat1.MessageUnboxedValid{
			ClientHeader: chat1.MessageClientHeaderVerified{
				MessageType: chat1.MessageType_METADATA,
			},
			MessageBody: chat1.NewMessageBodyWithMetadata(chat1.MessageConversationMetadata{ConversationTitle: *topicName}),
		}
		md := chat1.NewMessageUnboxedWithValid(v)
		m.convs[m.convKey(name, topicName)] = chat1.ConversationLocal{
			Info: chat1.ConversationInfoLocal{
				Id: rb,
			},
			MaxMessages: []chat1.MessageUnboxed{md},
		}
	}

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

func (m *mockChatHelper) FindConversations(ctx context.Context, name string, topicName *string, topicType chat1.TopicType,
	membersType chat1.ConversationMembersType, vis keybase1.TLFVisibility) ([]chat1.ConversationLocal, error) {

	conv, ok := m.convs[m.convKey(name, topicName)]
	if ok {
		return []chat1.ConversationLocal{conv}, nil
	}

	return nil, nil
}

func (m *mockChatHelper) FindConversationsByID(ctx context.Context, convIDs []chat1.ConversationID) (convs []chat1.ConversationLocal, err error) {
	for _, id := range convIDs {
		for _, v := range m.convs {
			if bytes.Equal(v.Info.Id, id) {
				convs = append(convs, v)
			}
		}
	}
	return convs, nil
}

func (m *mockChatHelper) GetChannelTopicName(ctx context.Context, teamID keybase1.TeamID,
	topicType chat1.TopicType, convID chat1.ConversationID) (string, error) {
	for _, v := range m.convs {
		if v.Info.Id.Eq(convID) {
			return utils.GetTopicName(v), nil
		}
	}
	return "", fmt.Errorf("mockChatHelper.GetChannelTopicName conv not found %v", convID)
}

func (m *mockChatHelper) convKey(name string, topicName *string) string {
	if topicName == nil {
		return name + ":general"
	}
	return name + ":" + *topicName
}
