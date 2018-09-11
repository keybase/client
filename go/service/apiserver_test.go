package service

import (
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

func TestAPIServerGet(t *testing.T) {
	tc := libkb.SetupTest(t, "apiserver", 2)
	defer tc.Cleanup()
	tc.G.SetService()

	_, err := kbtest.CreateAndSignupFakeUser("apivr", tc.G)
	if err != nil {
		t.Fatal(err)
	}

	harg := []keybase1.StringKVPair{
		{Key: "username", Value: "t_alice"},
		{Key: "fields", Value: "basics"},
	}

	arg := keybase1.GetArg{
		Endpoint: "user/lookup",
		Args:     harg,
	}

	handler := NewAPIServerHandler(nil, tc.G)
	res, err := handler.doGet(arg, false)
	if err != nil {
		t.Fatal(err)
	}

	jw, err := jsonw.Unmarshal([]byte(res.Body))
	if err != nil {
		t.Fatal(err)
	}

	usernamew := jw.AtKey("them").AtKey("basics").AtKey("username")
	username, err := usernamew.GetString()
	if err != nil {
		t.Fatal(err)
	}

	if username != "t_alice" {
		t.Fatalf("wrong username returned: %s != %s", username, "t_alice")
	}
}

func TestAPIServerPost(t *testing.T) {

	tc := libkb.SetupTest(t, "apiserver", 2)
	defer tc.Cleanup()
	tc.G.SetService()

	_, err := kbtest.CreateAndSignupFakeUser("apivr", tc.G)
	if err != nil {
		t.Fatal(err)
	}

	harg := []keybase1.StringKVPair{
		{Key: "email_or_username", Value: "t_alice"},
	}

	arg := keybase1.PostArg{
		Endpoint: "getsalt",
		Args:     harg,
	}

	handler := NewAPIServerHandler(nil, tc.G)
	res, err := handler.doPost(arg)
	if err != nil {
		t.Fatal(err)
	}

	jw, err := jsonw.Unmarshal([]byte(res.Body))
	if err != nil {
		t.Fatal(err)
	}

	namew := jw.AtKey("status").AtKey("name")
	name, err := namew.GetString()
	if err != nil {
		t.Fatal(err)
	}

	if name != "OK" {
		t.Fatalf("wrong name returned: %s != %s", name, "OK")
	}
}

func TestAPIServerPostJSON(t *testing.T) {

	tc := libkb.SetupTest(t, "apiserver", 2)
	defer tc.Cleanup()
	tc.G.SetService()

	_, err := kbtest.CreateAndSignupFakeUser("apivr", tc.G)
	if err != nil {
		t.Fatal(err)
	}

	jsonPayload := []keybase1.StringKVPair{
		{Key: "sigs", Value: "[]"},
	}

	arg := keybase1.PostJSONArg{
		Endpoint:    "key/multi",
		JSONPayload: jsonPayload,
	}

	handler := NewAPIServerHandler(nil, tc.G)
	res, err := handler.doPostJSON(arg)
	if err != nil {
		t.Fatal(err)
	}

	jw, err := jsonw.Unmarshal([]byte(res.Body))
	if err != nil {
		t.Fatal(err)
	}

	namew := jw.AtKey("status").AtKey("name")
	name, err := namew.GetString()
	if err != nil {
		t.Fatal(err)
	}

	if name != "OK" {
		t.Fatalf("wrong name returned: %s != %s", name, "OK")
	}
}
