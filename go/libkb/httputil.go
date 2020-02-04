package libkb

import (
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
)

func discardAndClose(rc io.ReadCloser) (int64, error) {
	bytesRead, _ := io.Copy(ioutil.Discard, rc)
	return bytesRead, rc.Close()
}

// DiscardAndCloseBody reads as much as possible from the body of the
// given response, and then closes it.
//
// This is because, in order to free up the current connection for
// re-use, a response body must be read from before being closed; see
// http://stackoverflow.com/a/17953506 .
//
// Instead of doing:
//
//   res, _ := ...
//   defer res.Body.Close()
//
// do
//
//   res, _ := ...
//   defer DiscardAndCloseBody(res)
//
// instead.
func DiscardAndCloseBody(resp *http.Response) (int64, error) {
	if resp == nil {
		return 0, fmt.Errorf("Nothing to discard (http.Response was nil)")
	}
	return discardAndClose(resp.Body)
}
