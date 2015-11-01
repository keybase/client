// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkb

import (
	keybase1 "github.com/keybase/client/go/protocol"
	jsonw "github.com/keybase/go-jsonw"
)

func GetKID(w *jsonw.Wrapper) (kid keybase1.KID, err error) {
	var s string
	s, err = w.GetString()
	if err != nil {
		return
	}
	kid = keybase1.KIDFromString(s)
	return
}
