package libkb

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestHTTPSrv(t *testing.T) {
	tc := SetupTest(t, "TestAvatarsFullCaching", 1)
	defer tc.Cleanup()

	test := func(s HTTPSrvListenerSource) {
		srv := NewHTTPSrv(tc.G, s)
		mux := http.NewServeMux()
		mux.HandleFunc("/test", func(resp http.ResponseWriter, req *http.Request) {
			fmt.Fprintf(resp, "success")
		})
		_, err := srv.EnsureActive(mux)
		require.NoError(t, err)
		addr, err := srv.Addr()
		require.NoError(t, err)
		url := fmt.Sprintf("http://%s/test", addr)
		t.Logf("url: %s", url)
		resp, err := http.Get(url)
		require.NoError(t, err)
		out, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, "success", string(out))
		srv.Stop()
	}
	test(NewRandomPortListenerSource())
	test(NewPortRangeListenerSource(7000, 8000))
}
