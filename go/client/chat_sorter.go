// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"sort"

	"github.com/keybase/client/go/protocol/chat1"
)

type messageSorter struct {
	Messages []chat1.MessageFromServerOrError
}

// Return a copy sorted by message id.
// Messages without IDs (errors) end up at the top (non-stable ordering).
func (s messageSorter) ascending() []chat1.MessageFromServerOrError {
	xs := make([]chat1.MessageFromServerOrError, len(s.Messages))
	copy(xs, s.Messages)
	sort.Sort(byMessageIDAsc(xs))
	return xs
}

type byMessageIDAsc []chat1.MessageFromServerOrError

func (a byMessageIDAsc) Len() int           { return len(a) }
func (a byMessageIDAsc) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a byMessageIDAsc) Less(i, j int) bool { return a.key(i) < a.key(j) }
func (a byMessageIDAsc) key(i int) int {
	m := a[i]
	if m.Message == nil {
		return -1
	}
	return int(m.Message.ServerHeader.MessageID)
}
