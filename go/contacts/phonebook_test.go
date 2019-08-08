// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package contacts

import (
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestMakeAssertionToName(t *testing.T) {
	contacts := []keybase1.ProcessedContact{
		{
			Assertion:   "[example@example.com]@email",
			ContactName: "Example 1",
		},
		{
			Assertion:   "1234567890@phone",
			ContactName: "Mr. Contact",
		},
		{
			Assertion:   "[example@example.com]@email",
			ContactName: "Example 2",
		},
	}
	assertionToName := makeAssertionToName(contacts)

	require.Contains(t, assertionToName, "1234567890@phone")
	// Exclude ambiguous email
	require.NotContains(t, assertionToName, "[example@example.com]@email")
}
