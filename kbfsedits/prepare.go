// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsedits

import "encoding/json"

// Prepare converts the given slice of notifications into a string
// suitable for sending/storing them.
func Prepare(edits []NotificationMessage) (string, error) {
	buf, err := json.Marshal(edits)
	if err != nil {
		return "", err
	}
	return string(buf), nil
}

// PrepareSelfWrite converts the given message into a string suitable
// for sending/storing it.
func PrepareSelfWrite(msg SelfWriteMessage) (string, error) {
	buf, err := json.Marshal(msg)
	if err != nil {
		return "", err
	}
	return string(buf), nil
}
