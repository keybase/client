package libkb

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRandomPortHTTPSrv(t *testing.T) {
	srv := NewRandomPortHTTPSrv()
	require.NoError(t, srv.Start())
	srv.HandleFunc("/test", func(resp http.ResponseWriter, req *http.Request) {
		fmt.Fprintf(resp, "success")
	})
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
