package chat

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/emails"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/phonenumbers"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type ProveRooterUI struct {
	Username string
}

func (p *ProveRooterUI) PromptUsername(_ context.Context, _ keybase1.PromptUsernameArg) (string, error) {
	return p.Username, nil
}

func (p *ProveRooterUI) OutputInstructions(_ context.Context, arg keybase1.OutputInstructionsArg) error {
	return nil
}

func (p *ProveRooterUI) PromptOverwrite(_ context.Context, _ keybase1.PromptOverwriteArg) (bool, error) {
	return true, nil
}

func (p *ProveRooterUI) OutputPrechecks(_ context.Context, _ keybase1.OutputPrechecksArg) error {
	return nil
}

func (p *ProveRooterUI) PreProofWarning(_ context.Context, _ keybase1.PreProofWarningArg) (bool, error) {
	return true, nil
}

func (p *ProveRooterUI) DisplayRecheckWarning(_ context.Context, _ keybase1.DisplayRecheckWarningArg) error {
	return nil
}

func (p *ProveRooterUI) OkToCheck(_ context.Context, _ keybase1.OkToCheckArg) (bool, error) {
	return true, nil
}

func (p *ProveRooterUI) Checking(_ context.Context, _ keybase1.CheckingArg) error {
	return nil
}

func (p *ProveRooterUI) ContinueChecking(_ context.Context, _ int) (bool, error) {
	return true, nil
}

func proveRooter(t *testing.T, g *libkb.GlobalContext, fu *kbtest.FakeUser) {
	arg := keybase1.StartProofArg{
		Service:  "rooter",
		Username: fu.Username,
		Auto:     true,
	}

	eng := engine.NewProve(g, &arg)

	proveUI := &ProveRooterUI{Username: fu.Username}

	uis := libkb.UIs{
		LogUI:    g.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
		ProveUI:  proveUI,
	}
	m := libkb.NewMetaContextTODO(g).WithUIs(uis)

	require.NoError(t, engine.RunEngine2(m, eng))

	checkEng := engine.NewProveCheck(g, eng.SigID())
	require.NoError(t, engine.RunEngine2(m, checkEng))
	found, status, state, text := checkEng.Results()
	if !found {
		t.Errorf("proof not found, expected to be found")
	}
	if status != 1 {
		t.Errorf("proof status: %d, expected 1", int(status))
	}
	if state != 1 {
		t.Errorf("proof state: %d, expected 1", int(state))
	}
	if len(text) == 0 {
		t.Errorf("empty proof text, expected non-empty")
	}
}

func addAndVerifyPhone(t *testing.T, g *libkb.GlobalContext, phoneNumber keybase1.PhoneNumber) {
	mctx := libkb.NewMetaContextTODO(g)
	require.NoError(t, phonenumbers.AddPhoneNumber(mctx, phoneNumber, keybase1.IdentityVisibility_PRIVATE))

	code, err := kbtest.GetPhoneVerificationCode(libkb.NewMetaContextTODO(g), phoneNumber)
	require.NoError(t, err)

	require.NoError(t, phonenumbers.VerifyPhoneNumber(mctx, phoneNumber, code))

	t.Logf("Added and verified phone number: %s", phoneNumber.String())
}

type sbsTestCase struct {
	getChatAssertion func(user *kbtest.FakeUser) string
	sbsVerify        func(user *kbtest.FakeUser, g *libkb.GlobalContext)
}

func runChatSBSScenario(t *testing.T, testCase sbsTestCase) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		runWithEphemeral(t, mt, func(ephemeralLifetime *gregor1.DurationSec) {
			ctc := makeChatTestContext(t, "TestChatSrvSBS", 2)
			defer ctc.cleanup()
			users := ctc.users()

			// Only run this test for imp teams
			switch mt {
			case chat1.ConversationMembersType_IMPTEAMNATIVE, chat1.ConversationMembersType_IMPTEAMUPGRADE:
			default:
				return
			}
			// If we are sending ephemeral messages make sure both users have
			// user/device EKs
			if ephemeralLifetime != nil {
				u1 := ctc.as(t, users[0])
				u1.h.G().GetEKLib().KeygenIfNeeded(u1.h.G().MetaContext(context.Background()))
				u2 := ctc.as(t, users[1])
				u2.h.G().GetEKLib().KeygenIfNeeded(u2.h.G().MetaContext(context.Background()))
			}

			tc1 := ctc.world.Tcs[users[1].Username]
			ctx := ctc.as(t, users[0]).startCtx
			listener0 := newServerChatListener()
			ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)
			listener1 := newServerChatListener()
			ctc.as(t, users[1]).h.G().NotifyRouter.AddListener(listener1)

			convoAssertions := []string{
				users[0].Username,
				testCase.getChatAssertion(users[1]),
			}
			displayName := strings.Join(convoAssertions, ",")

			t.Logf("Creating a convo with display name %q", displayName)

			ncres, err := ctc.as(t, users[0]).chatLocalHandler().NewConversationLocal(ctx,
				chat1.NewConversationLocalArg{
					TlfName:          displayName,
					TopicType:        chat1.TopicType_CHAT,
					TlfVisibility:    keybase1.TLFVisibility_PRIVATE,
					MembersType:      mt,
					IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
				})
			require.NoError(t, err)

			mustPostLocalEphemeralForTest(t, ctc, users[0], ncres.Conv.Info,
				chat1.NewMessageBodyWithText(chat1.MessageText{
					Body: "HI",
				}), ephemeralLifetime)
			require.NoError(t, err)
			consumeNewMsgRemote(t, listener0, chat1.MessageType_TEXT)

			_, err = postLocalEphemeralForTest(t, ctc, users[1], ncres.Conv.Info,
				chat1.NewMessageBodyWithText(chat1.MessageText{
					Body: "HI",
				}), ephemeralLifetime)
			require.Error(t, err)
			require.IsType(t, utils.ErrGetVerifiedConvNotFound, err)

			t.Logf("running sbsVerify now")

			kickTeamRekeyd(tc1.Context().ExternalG(), t)
			testCase.sbsVerify(users[1], tc1.Context().ExternalG())

			t.Logf("uid1: %s", users[1].User.GetUID())
			t.Logf("teamID: %s", ncres.Conv.Info.Triple.Tlfid)
			t.Logf("convID: %x", ncres.Conv.GetConvID().DbShortForm())

			select {
			case rres := <-listener0.membersUpdate:
				require.Equal(t, ncres.Conv.GetConvID(), rres.ConvID)
				require.Equal(t, 1, len(rres.Members))
				require.Equal(t, users[1].Username, rres.Members[0].Member)
			case <-time.After(20 * time.Second):
				require.Fail(t, "no resolve")
			}
			select {
			case rres := <-listener1.joinedConv:
				require.NotNil(t, rres)
				require.Equal(t, ncres.Conv.GetConvID().String(), rres.ConvID)
				require.Equal(t, 2, len(rres.Participants))
			case <-time.After(20 * time.Second):
				require.Fail(t, "no resolve")
			}

			mustPostLocalEphemeralForTest(t, ctc, users[0], ncres.Conv.Info,
				chat1.NewMessageBodyWithText(chat1.MessageText{
					Body: "HI",
				}), ephemeralLifetime)
			consumeNewMsgRemote(t, listener0, chat1.MessageType_TEXT)
			consumeNewMsgRemote(t, listener1, chat1.MessageType_TEXT)

			mustPostLocalEphemeralForTest(t, ctc, users[1], ncres.Conv.Info,
				chat1.NewMessageBodyWithText(chat1.MessageText{
					Body: "HI",
				}), ephemeralLifetime)
			consumeNewMsgRemote(t, listener0, chat1.MessageType_TEXT)
			consumeNewMsgRemote(t, listener1, chat1.MessageType_TEXT)
			verifyThread := func(user *kbtest.FakeUser) {
				tvres, err := ctc.as(t, user).chatLocalHandler().GetThreadLocal(ctx, chat1.GetThreadLocalArg{
					ConversationID: ncres.Conv.GetConvID(),
					Query: &chat1.GetThreadQuery{
						MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
					},
				})
				require.NoError(t, err)
				require.Equal(t, 3, len(tvres.Thread.Messages))

				for _, msg := range tvres.Thread.Messages {
					// Whether unboxing will succeed in the ephemeral case
					// depends on whether pairwise MAC'ing was used, which in
					// turn depends on the size of the team, in a way that we
					// might tune in the future. Allow that specific failure.

					if ephemeralLifetime != nil && msg.IsError() {
						require.Equal(t, chat1.MessageUnboxedErrorType_PAIRWISE_MISSING, msg.Error().ErrType)
					} else {
						require.True(t, msg.IsValid())
					}
				}
			}

			verifyThread(users[0])
			verifyThread(users[1])
		})
	})

}

func TestChatSrvRooter(t *testing.T) {
	runChatSBSScenario(t, sbsTestCase{
		getChatAssertion: func(user *kbtest.FakeUser) string {
			return fmt.Sprintf("%s@rooter", user.Username)
		},
		sbsVerify: func(user *kbtest.FakeUser, g *libkb.GlobalContext) {
			proveRooter(t, g, user)
		},
	})
}

func TestChatSrvPhone(t *testing.T) {
	var phone string
	runChatSBSScenario(t, sbsTestCase{
		getChatAssertion: func(user *kbtest.FakeUser) string {
			phone = kbtest.GenerateTestPhoneNumber()
			return fmt.Sprintf("%s@phone", phone)
		},
		sbsVerify: func(user *kbtest.FakeUser, g *libkb.GlobalContext) {
			phoneNumber := keybase1.PhoneNumber("+" + phone)
			addAndVerifyPhone(t, g, phoneNumber)
			phonenumbers.SetVisibilityPhoneNumber(libkb.NewMetaContextTODO(g), phoneNumber, keybase1.IdentityVisibility_PUBLIC)
		},
	})
}

func TestChatSrvEmail(t *testing.T) {
	runChatSBSScenario(t, sbsTestCase{
		getChatAssertion: func(user *kbtest.FakeUser) string {
			return fmt.Sprintf("[%s]@email", user.Email)
		},
		sbsVerify: func(user *kbtest.FakeUser, g *libkb.GlobalContext) {
			email := keybase1.EmailAddress(user.Email)
			kbtest.VerifyEmailAuto(libkb.NewMetaContextTODO(g), email)
			emails.SetVisibilityEmail(libkb.NewMetaContextTODO(g), email, keybase1.IdentityVisibility_PUBLIC)
		},
	})
}
