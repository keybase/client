// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package lifecycle

func Holds(c *Controller) int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.holds)
}
