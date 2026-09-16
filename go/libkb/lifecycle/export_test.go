// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package lifecycle

func SetTestHookAfterWindowUpdate(c *Controller, hook func()) { c.testHookAfterWindowUpdate = hook }

func TaskGen(c *Controller) uint64 { return c.taskGen.Load() }
