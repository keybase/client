package avatars

import (
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

type apiHandlerFn func(libkb.MetaContext, libkb.APIArg, libkb.APIResponseWrapper) error
type avatarMockAPI struct {
	libkb.API
	handler apiHandlerFn
}

func (a *avatarMockAPI) GetDecode(mctx libkb.MetaContext, arg libkb.APIArg, res libkb.APIResponseWrapper) error {
	return a.handler(mctx, arg, res)
}

func newAvatarMockAPI(f apiHandlerFn) *avatarMockAPI {
	return &avatarMockAPI{handler: f}
}

func makeHandler(url string, cb chan struct{}) apiHandlerFn {
	return func(mctx libkb.MetaContext, arg libkb.APIArg, res libkb.APIResponseWrapper) error {
		m := make(map[keybase1.AvatarFormat]keybase1.AvatarUrl)
		m["square"] = keybase1.MakeAvatarURL(url)
		res.(*apiAvatarRes).Pictures = []map[keybase1.AvatarFormat]keybase1.AvatarUrl{m}
		cb <- struct{}{}
		return nil
	}
}

func TestAvatarsURLCaching(t *testing.T) {
	tc := libkb.SetupTest(t, "TestAvatarsURLCaching", 1)
	defer tc.Cleanup()

	clock := clockwork.NewFakeClock()
	tc.G.SetClock(clock)

	cb := make(chan struct{}, 5)

	tc.G.API = newAvatarMockAPI(makeHandler("url", cb))
	source := NewURLCachingSource(time.Hour, 10)

	t.Logf("API server fetch")
	m := libkb.NewMetaContextForTest(tc)
	res, err := source.LoadUsers(m, []string{"mike"}, []keybase1.AvatarFormat{"square"})
	require.NoError(t, err)
	require.Equal(t, "url", res.Picmap["mike"]["square"].String())
	select {
	case <-cb:
	case <-time.After(20 * time.Second):
		require.Fail(t, "no API call")
	}
	t.Logf("cache fetch")
	res, err = source.LoadUsers(m, []string{"mike"}, []keybase1.AvatarFormat{"square"})
	require.NoError(t, err)
	require.Equal(t, "url", res.Picmap["mike"]["square"].String())
	select {
	case <-cb:
		require.Fail(t, "no API call")
	default:
	}

	t.Logf("stale")
	source.staleFetchCh = make(chan struct{}, 5)
	clock.Advance(2 * time.Hour)
	tc.G.API = newAvatarMockAPI(makeHandler("url2", cb))
	res, err = source.LoadUsers(m, []string{"mike"}, []keybase1.AvatarFormat{"square"})
	require.NoError(t, err)
	require.Equal(t, "url", res.Picmap["mike"]["square"].String())
	select {
	case <-cb:
	case <-time.After(20 * time.Second):
		require.Fail(t, "no API call")
	}
	select {
	case <-source.staleFetchCh:
	case <-time.After(20 * time.Second):
		require.Fail(t, "no stale fetch")
	}
	res, err = source.LoadUsers(m, []string{"mike"}, []keybase1.AvatarFormat{"square"})
	require.NoError(t, err)
	require.Equal(t, "url2", res.Picmap["mike"]["square"].String())
	select {
	case <-cb:
		require.Fail(t, "no API call")
	default:
	}
}
