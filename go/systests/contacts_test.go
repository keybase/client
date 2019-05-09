// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package systests

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"

	"github.com/keybase/client/go/kbtest"
)

func TestLookupPhoneNumbers(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")

	phone := keybase1.PhoneNumber("+" + kbtest.GenerateTestPhoneNumber())

	phoneCli := keybase1.PhoneNumbersClient{Cli: ann.teamsClient.Cli}
	err := phoneCli.AddPhoneNumber(context.Background(), keybase1.AddPhoneNumberArg{
		PhoneNumber: phone,
		Visibility:  keybase1.IdentityVisibility_PUBLIC,
	})
	require.NoError(t, err)

	code, err := kbtest.GetPhoneVerificationCode(ann.MetaContext(), phone)
	require.NoError(t, err)

	err = phoneCli.VerifyPhoneNumber(context.Background(), keybase1.VerifyPhoneNumberArg{
		PhoneNumber: phone,
		Code:        code,
	})
	require.NoError(t, err)

	contactsCli := keybase1.ContactsClient{Cli: ann.teamsClient.Cli}
	rawPhone := keybase1.RawPhoneNumber(phone)
	res, err := contactsCli.LookupContactList(context.Background(), keybase1.LookupContactListArg{
		Contacts: []keybase1.Contact{
			keybase1.Contact{Name: "It's me",
				Components: []keybase1.ContactComponent{
					keybase1.ContactComponent{
						PhoneNumber: &rawPhone,
					},
				},
			},
		},
	})
	require.NoError(t, err)
	require.Len(t, res, 1)
	contactRes := res[0]
	require.True(t, contactRes.Resolved)
	require.Equal(t, ann.uid, contactRes.Uid)
	require.NotNil(t, contactRes.Component.PhoneNumber)
	require.Equal(t, rawPhone, *contactRes.Component.PhoneNumber)
}
