package systests

import (
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestEmailVerificationNotifications(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	bob := tt.addUser("bob")
	email := bob.userInfo.email
	expectedNotification := []keybase1.EmailAddress{keybase1.EmailAddress(email)}
	bobListener := setupUserWithMockEmailListener(bob)

	// verifying an email address fires off an "email.verified" notification with the email
	err := kbtest.VerifyEmailAuto(bob.MetaContext(), keybase1.EmailAddress(email))
	require.NoError(t, err)
	bob.drainGregor()
	require.Equal(t, bobListener.verifiedEmails, expectedNotification)
}

type mockEmailListener struct {
	libkb.NoopNotifyListener
	verifiedEmails []keybase1.EmailAddress
}

var _ libkb.NotifyListener = (*mockEmailListener)(nil)

func (n *mockEmailListener) EmailAddressVerified(emailAddress keybase1.EmailAddress) {
	n.verifiedEmails = append(n.verifiedEmails, emailAddress)
}

func setupUserWithMockEmailListener(user *userPlusDevice) *mockEmailListener {
	userListener := &mockEmailListener{
		verifiedEmails: []keybase1.EmailAddress(nil),
	}
	user.tc.G.SetService()
	user.tc.G.NotifyRouter.AddListener(userListener)
	return userListener
}
