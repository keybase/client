// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin

package libkb

import "fmt"

func IsMounted(g *GlobalContext, dir string) (bool, error) {
	return false, fmt.Errorf("IsMounted unsupported on this platform")
}
