// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package tlf

import (
	"testing"

	kbname "github.com/keybase/client/go/kbun"
	"github.com/stretchr/testify/assert"
)

func TestCanonicalToPreferredName(t *testing.T) {
	for _, q := range []struct {
		As     kbname.NormalizedUsername
		Try    CanonicalName
		Answer PreferredName
	}{
		{"", "a,b,c", "a,b,c"},
		{"a", "a,b,c", "a,b,c"},
		{"b", "a,b,c", "b,a,c"},
		{"c", "a,b,c", "c,a,b"},
		{"b", "a,b,c#d,e", "b,a,c#d,e"},
		{"d", "a,b,c#d,e", "a,b,c#d,e"},
		{"e", "a,b,c#d,e", "a,b,c#e,d"},
	} {
		r, err := CanonicalToPreferredName(q.As, q.Try)
		assert.Equal(t, q.Answer, r)
		assert.NoError(t, err)
	}
}
