// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"testing"

	jsonw "github.com/keybase/go-jsonw"
)

func TestInvitationArgs(t *testing.T) {
	tc := SetupTest(t, "invite", 1)
	defer tc.Cleanup()

	rec := newSendInvitationMock()
	tc.G.API = rec

	email := "email@nomail.keybase.io"
	inv, err := SendInvitation(tc.G, email, InviteArg{Message: "message", NoteToSelf: "note"})
	if err != nil {
		t.Fatal(err)
	}
	if len(rec.Args) != 1 {
		t.Fatalf("recorded args: %d, expected 1", len(rec.Args))
	}
	checkArg(t, rec.Args[0])
	checkHTTPArg(t, rec.Args[0], "email", email)
	checkHTTPArg(t, rec.Args[0], "invitation_message", "message")
	checkHTTPArg(t, rec.Args[0], "note_to_self", "note")
	checkInvitation(t, inv)

	rec.Reset()

	inv, err = GenerateInvitationCode(tc.G, InviteArg{})
	if err != nil {
		t.Fatal(err)
	}
	if len(rec.Args) != 1 {
		t.Fatalf("recorded args: %d, expected 1", len(rec.Args))
	}
	checkArg(t, rec.Args[0])
	checkHTTPArg(t, rec.Args[0], "invitation_message", "")
	checkHTTPArg(t, rec.Args[0], "note_to_self", "")
	checkInvitation(t, inv)

	rec.Reset()

	assertion, ok := NormalizeSocialAssertion(testAssertionContext{}, "twitter:KeyBase")
	if !ok {
		t.Fatal("invalid social assertion")
	}
	inv, err = GenerateInvitationCodeForAssertion(tc.G, assertion, InviteArg{})
	if err != nil {
		t.Fatal(err)
	}
	if len(rec.Args) != 1 {
		t.Fatalf("recorded args: %d, expected 1", len(rec.Args))
	}
	checkArg(t, rec.Args[0])
	checkHTTPArg(t, rec.Args[0], "assertion", "keybase@twitter")
	checkHTTPArg(t, rec.Args[0], "invitation_message", "")
	checkHTTPArg(t, rec.Args[0], "note_to_self", "")
	checkInvitation(t, inv)
}

func checkArg(t *testing.T, arg APIArg) {
	if arg.Endpoint != "send_invitation" {
		t.Errorf("endpoint: %s, expected send_invitation", arg.Endpoint)
	}
	if arg.SessionType != APISessionTypeREQUIRED {
		t.Errorf("SessionType should be APISessionTypeREQUIRED")
	}
}

func checkHTTPArg(t *testing.T, arg APIArg, key, value string) {
	if arg.Args[key].String() != value {
		t.Errorf("%s parameter: %q, expected %q", key, arg.Args[key], value)
	}

}

func checkInvitation(t *testing.T, inv *Invitation) {
	if inv.ID != "2b25175f6da1d9155f23800d" {
		t.Errorf("invitation id: %q, expected 2b25175f6da1d9155f23800d", inv.ID)
	}
	if inv.ShortCode != "clip outside broccoli culture" {
		t.Errorf("short code: %q, expected clip outside broccoli culture", inv.ShortCode)
	}
}

type sendInvitationMock struct {
	*APIArgRecorder
}

func newSendInvitationMock() *sendInvitationMock {
	return &sendInvitationMock{NewAPIArgRecorder()}
}

func (s *sendInvitationMock) Post(arg APIArg) (*APIRes, error) {
	if _, err := s.APIArgRecorder.Post(arg); err != nil {
		return nil, err
	}
	jw, err := jsonw.Unmarshal([]byte(`{"status":{"code":0,"name":"OK"},"short_code":"clip outside broccoli culture","invitation_id":"2b25175f6da1d9155f23800d","csrf_token":"lgHZIDBlNjRhNDBhOTQ3ZWYyMTMxOWQ4MzM1Y2M4YjQ1YjE5zlcVNMHOAAFRgMDEIFyHOIg/AetihKRvVMNT2NoBNNG1QoCVxtDfzEK7/rdF"}`))
	if err != nil {
		return nil, err
	}
	return &APIRes{
		Status:     jw.AtKey("status"),
		Body:       jw,
		HTTPStatus: 200,
		AppStatus: &AppStatus{
			Code: SCOk,
			Name: "OK",
			Desc: "Ok",
		},
	}, nil
}
