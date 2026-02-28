// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package util

import (
	"fmt"
	"strings"
)

// removeNilErrors returns error slice with nil errors removed
func removeNilErrors(errs []error) []error {
	if len(errs) == 0 {
		return nil
	}
	var r []error
	for _, err := range errs {
		if err != nil {
			r = append(r, err)
		}
	}
	return r
}

// CombineErrors returns a single error for multiple errors, or nil if none
func CombineErrors(errs ...error) error {
	errs = removeNilErrors(errs)
	if len(errs) == 0 {
		return nil
	} else if len(errs) == 1 {
		return errs[0]
	}

	// Combine multiple errors
	msgs := []string{}
	for _, err := range errs {
		msgs = append(msgs, err.Error())
	}
	return fmt.Errorf("There were multiple errors: %s", strings.Join(msgs, "; "))
}
