// Package errors provides the common infrastructure for managing errors.  It
// is primarily a wrapper around github.com/pkg/errors package.  See
// https://godoc.org/github.com/pkg/errors for usage instructions.
//
// While it is possible for most packages to use this package without needing
// the underlying package it is wrapping, certain usecases (such as interacting
// with the recorded stack trace) cannot avoid leakage.
package errors

import (
	"github.com/pkg/errors"
)

// StackTracer represents a type (usually an error) that can provide a stack
// trace.
type StackTracer interface {
	StackTrace() errors.StackTrace
}

// Cause returns the underlying cause of the error, if possible.  See
// https://godoc.org/github.com/pkg/errors#Cause for further details.
func Cause(err error) error {
	return errors.Cause(err)
}

// Errorf formats according to a format specifier and returns the string as a
// value that satisfies error. See
// https://godoc.org/github.com/pkg/errors#Errorf for further details
func Errorf(format string, args ...interface{}) error {
	return errors.Errorf(format, args...)
}

// New returns an error with the supplied message. See
// https://godoc.org/github.com/pkg/errors#New for further details
func New(message string) error {
	return errors.New(message)
}

// Wrap returns an error annotating err with message. If err is nil, Wrap
// returns nil.  See https://godoc.org/github.com/pkg/errors#Wrap for more
// details.
func Wrap(err error, message string) error {
	return errors.Wrap(err, message)
}

// Wrapf returns an error annotating err with the format specifier. If err is
// nil, Wrapf returns nil. See https://godoc.org/github.com/pkg/errors#Wrapf
// for more details.
func Wrapf(err error, format string, args ...interface{}) error {
	return errors.Wrapf(err, format, args...)
}
