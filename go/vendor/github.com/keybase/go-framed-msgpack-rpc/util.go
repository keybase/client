package rpc

import (
	"strings"
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
