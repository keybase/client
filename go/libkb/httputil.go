package libkb

import (
	"fmt"
	"io"
	"net/http"
)

func discardAndClose(rc io.ReadCloser) error {
	_, _ = io.Copy(io.Discard, rc)
	return rc.Close()
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
//	res, _ := ...
//	defer res.Body.Close()
//
// do
//
//	res, _ := ...
//	defer DiscardAndCloseBody(res)
//
// instead.
func DiscardAndCloseBody(resp *http.Response) error {
	if resp == nil {
		return fmt.Errorf("Nothing to discard (http.Response was nil)")
	}
	return discardAndClose(resp.Body)
}
