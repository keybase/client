package log

import (
	"context"
	"net/http"
	"time"

	"github.com/stellar/go/support/http/mutil"
)

// logStartOfRequest emits the logline that reports that an http request is
// beginning processing.  NOTE: this middleware
func logStartOfRequest(
	ctx context.Context,
	r *http.Request,
) {
	Ctx(ctx).WithFields(F{
		"subsys": "http",
		"path":   r.URL.String(),
		"method": r.Method,
		"ip":     r.RemoteAddr,
		"host":   r.Host,
	}).Info("starting request")
}

// logEndOfRequest emits the logline for the end of the request
func logEndOfRequest(
	ctx context.Context,
	duration time.Duration,
	mw mutil.WriterProxy,
) {
	Ctx(ctx).WithFields(F{
		"subsys":   "http",
		"status":   mw.Status(),
		"bytes":    mw.BytesWritten(),
		"duration": duration,
	}).Info("finished request")
}
