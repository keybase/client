package systests

import (
	"testing"

	"github.com/keybase/client/go/client"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type mockEmailNotification struct {
	list     []keybase1.Email
	category string
	email    keybase1.EmailAddress
}

type mockEmailListener struct {
	libkb.NoopNotifyListener
	verifiedEmails      []keybase1.EmailAddress
	changeNotifications []mockEmailNotification
}

var _ libkb.NotifyListener = (*mockEmailListener)(nil)

func (n *mockEmailListener) EmailAddressVerified(emailAddress keybase1.EmailAddress) {
	n.verifiedEmails = append(n.verifiedEmails, emailAddress)
}

func (n *mockEmailListener) EmailsChanged(list []keybase1.Email, category string, email keybase1.EmailAddress) {
	n.changeNotifications = append(n.changeNotifications, mockEmailNotification{
		list:     list,
		category: category,
		email:    email,
	})
}

func setupUserWithMockEmailListener(user *userPlusDevice) *mockEmailListener {
	userListener := &mockEmailListener{}
	user.tc.G.SetService()
	user.tc.G.NotifyRouter.AddListener(userListener)
	return userListener
}

func TestEmailVerificationNotifications(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	bob := tt.addUser("bob")
	email := bob.userInfo.email
	bobListener := setupUserWithMockEmailListener(bob)

	// verifying an email address fires off an "email.verified" notification with the email
	err := kbtest.VerifyEmailAuto(bob.MetaContext(), keybase1.EmailAddress(email))
	require.NoError(t, err)
	bob.drainGregor()
	expectedNotification := []keybase1.EmailAddress{keybase1.EmailAddress(email)}
	require.Equal(t, bobListener.verifiedEmails, expectedNotification)
}

func TestEmailChangeNotifications(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	bob := tt.addUser("bob")
	bobListener := setupUserWithMockEmailListener(bob)

	// Create new random email that we will add
	sinfo := randomUser("")

	cmd := client.CmdAddEmail{Contextified: libkb.NewContextified(bob.tc.G)}
	cmd.Email = sinfo.email
	cmd.Visibility = keybase1.IdentityVisibility_PRIVATE
	err := cmd.Run()
	require.NoError(t, err)

	bob.drainGregor()
	require.Len(t, bobListener.changeNotifications, 1)
	change := bobListener.changeNotifications[0]
	require.Equal(t, "email.added", change.category)
	require.EqualValues(t, sinfo.email, change.email)
	require.Len(t, change.list, 2)
}
