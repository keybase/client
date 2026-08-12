package service

import (
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
	"github.com/stretchr/testify/require"
)

func TestAPIServerGet(t *testing.T) {
	tc := libkb.SetupTest(t, "apiserver", 2)
	defer tc.Cleanup()
	tc.G.SetService()

	_, err := kbtest.CreateAndSignupFakeUser("apivr", tc.G)
	require.NoError(t, err)

	harg := []keybase1.StringKVPair{
		{Key: "username", Value: "t_alice"},
		{Key: "fields", Value: "basics"},
	}

	arg := keybase1.GetArg{
		Endpoint: "user/lookup",
		Args:     harg,
	}
	mctx := libkb.NewMetaContextForTest(tc)
	handler := NewAPIServerHandler(nil, tc.G)
	res, err := handler.doGet(mctx, arg, false)
	require.NoError(t, err)

	jw, err := jsonw.Unmarshal([]byte(res.Body))
	require.NoError(t, err)

	usernamew := jw.AtKey("them").AtKey("basics").AtKey("username")
	username, err := usernamew.GetString()
	require.NoError(t, err)

	require.Equal(t, "t_alice", username, "wrong username returned: %s != %s", username, "t_alice")
}

func TestAPIServerPost(t *testing.T) {
	tc := libkb.SetupTest(t, "apiserver", 2)
	defer tc.Cleanup()
	tc.G.SetService()

	_, err := kbtest.CreateAndSignupFakeUser("apivr", tc.G)
	require.NoError(t, err)

	harg := []keybase1.StringKVPair{
		{Key: "email_or_username", Value: "t_alice"},
	}

	arg := keybase1.PostArg{
		Endpoint: "getsalt",
		Args:     harg,
	}

	handler := NewAPIServerHandler(nil, tc.G)
	mctx := libkb.NewMetaContextForTest(tc)
	res, err := handler.doPost(mctx, arg)
	require.NoError(t, err)

	jw, err := jsonw.Unmarshal([]byte(res.Body))
	require.NoError(t, err)

	namew := jw.AtKey("status").AtKey("name")
	name, err := namew.GetString()
	require.NoError(t, err)

	require.Equal(t, "OK", name, "wrong name returned: %s != %s", name, "OK")
}

func TestAPIServerPostJSON(t *testing.T) {
	tc := libkb.SetupTest(t, "apiserver", 2)
	defer tc.Cleanup()
	tc.G.SetService()

	_, err := kbtest.CreateAndSignupFakeUser("apivr", tc.G)
	require.NoError(t, err)

	jsonPayload := []keybase1.StringKVPair{
		{Key: "sigs", Value: "[]"},
	}

	arg := keybase1.PostJSONArg{
		Endpoint:    "key/multi",
		JSONPayload: jsonPayload,
	}

	handler := NewAPIServerHandler(nil, tc.G)
	res, err := handler.doPostJSON(libkb.NewMetaContextForTest(tc), arg)
	require.NoError(t, err)

	jw, err := jsonw.Unmarshal([]byte(res.Body))
	require.NoError(t, err)

	namew := jw.AtKey("status").AtKey("name")
	name, err := namew.GetString()
	require.NoError(t, err)

	require.Equal(t, "OK", name, "wrong name returned: %s != %s", name, "OK")
}
