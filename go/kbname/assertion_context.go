// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbname

type AssertionContext interface {
	NormalizeSocialName(service string, username string) (string, error)
}
