// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package util

import "strings"

// JoinPredicate joins strings with predicate
func JoinPredicate(arr []string, delimeter string, f func(s string) bool) string {
	arrNew := make([]string, 0, len(arr))
	for _, s := range arr {
		if f(s) {
			arrNew = append(arrNew, s)
		}
	}
	return strings.Join(arrNew, delimeter)
}
