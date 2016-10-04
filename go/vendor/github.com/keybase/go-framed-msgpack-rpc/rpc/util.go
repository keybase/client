package rpc

import (
	"strings"

	"golang.org/x/net/context"
)

func makeMethodName(prot string, method string) string {
	if prot == "" {
		return method
	}
	return prot + "." + method
}

func splitMethodName(n string) (string, string) {
	i := strings.LastIndex(n, ".")
	if i == -1 {
		return "", n
	}
	return n[:i], n[i+1:]
}

func runInBg(f func() error) chan error {
	done := make(chan error)
	go func() {
		done <- f()
	}()
	return done
}

func wrapError(f WrapErrorFunc, e error) interface{} {
	if f != nil {
		return f(e)
	}
	if e == nil {
		return nil
	}
	return e.Error()
}

// Runs fn (which may block) in a separate goroutine and waits for it
// to finish, unless ctx is cancelled. Returns nil only when fn was
// run to completion and succeeded.  Any closed-over variables updated
// in fn should be considered visible only if nil is returned.
func runUnlessCanceled(ctx context.Context, fn func() error) error {
	c := make(chan error, 1) // buffered, in case the request is canceled
	go func() {
		c <- fn()
	}()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case err := <-c:
		return err
	}
}
