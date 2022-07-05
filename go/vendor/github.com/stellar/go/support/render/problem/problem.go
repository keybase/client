package problem

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/stellar/go/support/errors"
)

var (
	ServiceHost     = "https://stellar.org/horizon-errors/"
	errToProblemMap = map[error]P{}
)

var (
	// ServerError is a well-known problem type. Use it as a shortcut.
	ServerError = P{
		Type:   "server_error",
		Title:  "Internal Server Error",
		Status: http.StatusInternalServerError,
		Detail: "An error occurred while processing this request.  This is usually due " +
			"to a bug within the server software.  Trying this request again may " +
			"succeed if the bug is transient, otherwise please report this issue " +
			"to the issue tracker at: https://github.com/stellar/go/issues." +
			" Please include this response in your issue.",
	}

	// NotFound is a well-known problem type.  Use it as a shortcut in your actions
	NotFound = P{
		Type:   "not_found",
		Title:  "Resource Missing",
		Status: http.StatusNotFound,
		Detail: "The resource at the url requested was not found.  This is usually " +
			"occurs for one of two reasons:  The url requested is not valid, or no " +
			"data in our database could be found with the parameters provided.",
	}

	// BadRequest is a well-known problem type.  Use it as a shortcut
	// in your actions.
	BadRequest = P{
		Type:   "bad_request",
		Title:  "Bad Request",
		Status: http.StatusBadRequest,
		Detail: "The request you sent was invalid in some way",
	}
)

// P is a struct that represents an error response to be rendered to a connected
// client.
type P struct {
	Type   string                 `json:"type"`
	Title  string                 `json:"title"`
	Status int                    `json:"status"`
	Detail string                 `json:"detail,omitempty"`
	Extras map[string]interface{} `json:"extras,omitempty"`
}

func (p P) Error() string {
	return fmt.Sprintf("problem: %s", p.Type)
}

// RegisterError records an error -> P mapping, allowing the app to register
// specific errors that may occur in other packages to be rendered as a specific
// P instance.
//
// For example, you might want to render any sql.ErrNoRows errors as a
// problem.NotFound, and you would do so by calling:
//
// problem.RegisterError(sql.ErrNoRows, problem.NotFound) in you application
// initialization sequence
func RegisterError(err error, p P) {
	errToProblemMap[err] = p
}

// RegisterHost registers the service host url. It is used to prepend the host
// url to the error type. If you don't wish to prepend anything to the error
// type, register host as an empty string.
// The default service host points to `https://stellar.org/horizon-errors/`.
func RegisterHost(host string) {
	ServiceHost = host
}

// Render writes a http response to `w`, compliant with the "Problem
// Details for HTTP APIs" RFC:
// https://tools.ietf.org/html/draft-ietf-appsawg-http-problem-00
func Render(ctx context.Context, w http.ResponseWriter, err error) {
	origErr := errors.Cause(err)

	var problem P
	switch p := origErr.(type) {
	case P:
		problem = p
	case *P:
		problem = *p
	case error:
		var ok bool
		problem, ok = errToProblemMap[origErr]

		// If this error is not a registered error
		// log it and replace it with a 500 error
		if !ok {
			problem = ServerError
		}
	}

	renderProblem(ctx, w, problem)
}

func renderProblem(ctx context.Context, w http.ResponseWriter, p P) {
	if ServiceHost != "" && !strings.HasPrefix(p.Type, ServiceHost) {
		p.Type = ServiceHost + p.Type
	}

	w.Header().Set("Content-Type", "application/problem+json; charset=utf-8")

	js, err := json.MarshalIndent(p, "", "  ")
	if err != nil {
		err = errors.Wrap(err, "failed to encode problem")
		http.Error(w, "error rendering problem", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(p.Status)
	w.Write(js)
}

// MakeInvalidFieldProblem is a helper function to make a BadRequest with extras
func MakeInvalidFieldProblem(name string, reason error) *P {
	br := BadRequest
	br.Extras = map[string]interface{}{
		"invalid_field": name,
		"reason":        reason.Error(),
	}
	return &br
}
