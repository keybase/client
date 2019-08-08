package avatars

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/keybase/client/go/kbhttp"
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

	testSrv := kbhttp.NewSrv(tc.G.GetLog(), kbhttp.NewRandomPortRangeListenerSource(7000, 8000))
	require.NoError(t, testSrv.Start())
	testSrv.HandleFunc("/p", func(w http.ResponseWriter, req *http.Request) {
		fmt.Fprintf(w, "hi")
	})
	testSrv.HandleFunc("/p2", func(w http.ResponseWriter, req *http.Request) {
		fmt.Fprintf(w, "hi2")
	})
	testSrv.HandleFunc("/p3", func(w http.ResponseWriter, req *http.Request) {
		fmt.Fprintf(w, "hi3")
	})

	cb := make(chan struct{}, 5)
	a, _ := testSrv.Addr()
	testSrvAddr := fmt.Sprintf("http://%s/p", a)
	tc.G.API = newAvatarMockAPI(makeHandler(testSrvAddr, cb))
	m := libkb.NewMetaContextForTest(tc)
	source := NewFullCachingSource(time.Hour, 1)
	source.populateSuccessCh = make(chan struct{}, 5)
	source.tempDir = os.TempDir()
	source.StartBackgroundTasks(m)
	defer source.StopBackgroundTasks(m)

	t.Logf("first blood")
	res, err := source.LoadUsers(m, []string{"mike"}, []keybase1.AvatarFormat{"square"})
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

	convertPath := func(path string) string {
		path = strings.TrimPrefix(path, "file://")
		if runtime.GOOS == "windows" {
			path = strings.Replace(path, `/`, `\`, -1)
			path = path[1:]
		}
		return path
	}

	getFile := func(path string) string {
		path = convertPath(path)
		file, err := os.Open(path)
		require.NoError(t, err)
		defer file.Close()
		dat, err := ioutil.ReadAll(file)
		require.NoError(t, err)
		return string(dat)
	}
	res, err = source.LoadUsers(m, []string{"mike"}, []keybase1.AvatarFormat{"square"})
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
	mikePath := res.Picmap["mike"]["square"].String()
	require.NotEqual(t, testSrvAddr, mikePath)
	require.True(t, strings.HasPrefix(mikePath, "file://"))
	require.Equal(t, "hi", getFile(mikePath))

	t.Log("stale")
	testSrvAddr = fmt.Sprintf("http://%s/p2", a)
	tc.G.API = newAvatarMockAPI(makeHandler(testSrvAddr, cb))
	clock.Advance(2 * time.Hour)
	res, err = source.LoadUsers(m, []string{"mike"}, []keybase1.AvatarFormat{"square"})
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
	mikePath2 := res.Picmap["mike"]["square"].String()
	require.Equal(t, mikePath, mikePath2)
	res, err = source.LoadUsers(m, []string{"mike"}, []keybase1.AvatarFormat{"square"})
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
	mikePath2 = res.Picmap["mike"]["square"].String()
	require.Equal(t, mikePath2, mikePath)
	require.Equal(t, "hi2", getFile(mikePath2))

	// load a second user to validate we clear when the LRU is full
	res, err = source.LoadUsers(m, []string{"josh"}, []keybase1.AvatarFormat{"square"})
	require.NoError(t, err)
	require.Equal(t, testSrvAddr, res.Picmap["josh"]["square"].String())
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

	res, err = source.LoadUsers(m, []string{"josh"}, []keybase1.AvatarFormat{"square"})
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
	joshPath := res.Picmap["josh"]["square"].String()
	require.NotEqual(t, testSrvAddr, mikePath2)
	require.True(t, strings.HasPrefix(joshPath, "file://"))
	require.Equal(t, "hi2", getFile(joshPath))

	// mike was evicted
	_, err = os.Stat(convertPath(mikePath2))
	require.Error(t, err)
	require.True(t, os.IsNotExist(err))

	err = source.ClearCacheForName(m, "josh", []keybase1.AvatarFormat{"square"})
	require.NoError(t, err)

	_, err = os.Stat(convertPath(joshPath))
	require.Error(t, err)
	require.True(t, os.IsNotExist(err))
}
