package avatars

import (
	"context"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

func TestAvatarsFullCaching(t *testing.T) {
	tc := libkb.SetupTest(t, "TestAvatarsFullCaching", 1)
	defer tc.Cleanup()
	clock := clockwork.NewFakeClock()
	tc.G.SetClock(clock)

	testSrv := libkb.NewHTTPSrv(tc.G, libkb.NewPortRangeListenerSource(7000, 8000))
	require.NoError(t, testSrv.Start())
	testSrv.HandleFunc("/p", func(w http.ResponseWriter, req *http.Request) {
		fmt.Fprintf(w, "hi")
	})
	testSrv.HandleFunc("/p2", func(w http.ResponseWriter, req *http.Request) {
		fmt.Fprintf(w, "hi2")
	})

	ctx := context.TODO()
	cb := make(chan struct{}, 5)
	a, _ := testSrv.Addr()
	testSrvAddr := fmt.Sprintf("http://%s/p", a)
	tc.G.API = newAvatarMockAPI(makeHandler(testSrvAddr, cb))
	source := NewFullCachingSource(tc.G, time.Hour, 10)
	source.populateSuccessCh = make(chan struct{}, 5)
	source.tempDir = os.TempDir()
	source.StartBackgroundTasks()
	defer source.StopBackgroundTasks()

	t.Logf("first blood")
	res, err := source.LoadUsers(ctx, []string{"mike"}, []keybase1.AvatarFormat{"square"})
	require.NoError(t, err)
	require.Equal(t, testSrvAddr, res.Picmap["mike"]["square"].String())
	select {
	case <-cb:
	case <-time.After(20 * time.Second):
		require.Fail(t, "no API call")
	}
	select {
	case <-source.populateSuccessCh:
	case <-time.After(20 * time.Second):
		require.Fail(t, "no populate")
	}

	t.Log("cache hit")
	getFile := func(path string) string {
		path = strings.TrimPrefix(path, "file://")
		if runtime.GOOS == "windows" {
			path = strings.Replace(path, `/`, `\`, -1)
			path = path[1:]
		}
		file, err := os.Open(path)
		require.NoError(t, err)
		dat, err := ioutil.ReadAll(file)
		require.NoError(t, err)
		return string(dat)
	}
	res, err = source.LoadUsers(ctx, []string{"mike"}, []keybase1.AvatarFormat{"square"})
	require.NoError(t, err)
	select {
	case <-cb:
		require.Fail(t, "no API call")
	default:
	}
	select {
	case <-source.populateSuccessCh:
		require.Fail(t, "no populate")
	default:
	}
	val := res.Picmap["mike"]["square"].String()
	require.NotEqual(t, testSrvAddr, val)
	require.True(t, strings.HasPrefix(val, "file://"))
	require.Equal(t, "hi", getFile(val))

	t.Log("stale")
	testSrvAddr = fmt.Sprintf("http://%s/p2", a)
	tc.G.API = newAvatarMockAPI(makeHandler(testSrvAddr, cb))
	clock.Advance(2 * time.Hour)
	res, err = source.LoadUsers(ctx, []string{"mike"}, []keybase1.AvatarFormat{"square"})
	require.NoError(t, err)
	select {
	case <-cb:
	case <-time.After(20 * time.Second):
		require.Fail(t, "no API call")
	}
	select {
	case <-source.populateSuccessCh:
	case <-time.After(20 * time.Second):
		require.Fail(t, "no populate")
	}
	val2 := res.Picmap["mike"]["square"].String()
	require.Equal(t, val, val2)
	res, err = source.LoadUsers(ctx, []string{"mike"}, []keybase1.AvatarFormat{"square"})
	require.NoError(t, err)
	select {
	case <-cb:
		require.Fail(t, "no API call")
	default:
	}
	select {
	case <-source.populateSuccessCh:
		require.Fail(t, "no populate")
	default:
	}
	val2 = res.Picmap["mike"]["square"].String()
	require.Equal(t, val2, val)
	require.Equal(t, "hi2", getFile(val2))
}
