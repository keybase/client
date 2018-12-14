// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsedits

import "encoding/json"

// ReadSelfWrite converts the given message string into the
// SelfWriteMessage type, if possible.
func ReadSelfWrite(msg string) (ret SelfWriteMessage, err error) {
	err = json.Unmarshal([]byte(msg), &ret)
	if err != nil {
		return SelfWriteMessage{}, err
	}
	return ret, nil
}
