// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPaperKeyPhraseBasics(t *testing.T) {
	p, err := MakePaperKeyPhrase(0)
	require.NoError(t, err)
	q := NewPaperKeyPhrase(p.String())
	version, err := q.Version()
	require.NoError(t, err)
	require.Equal(t, 0, version, "version: %d, expected 0", version)
}

func TestPaperKeyPhraseTypos(t *testing.T) {
	p, err := MakePaperKeyPhrase(0)
	require.NoError(t, err)

	equivs := []string{
		p.String(),
		"   " + p.String(),
		p.String() + "  ",
		" " + p.String() + " ",
		"\t" + p.String() + "  ",
		" " + p.String() + "\t",
		strings.Join(strings.Split(p.String(), " "), "   "),
		strings.ToTitle(p.String()),
		strings.ToUpper(p.String()),
	}

	for _, s := range equivs {
		q := NewPaperKeyPhrase(s)
		version, err := q.Version()
		require.NoError(t, err)
		require.Equal(t, 0, version, "input: %q => version: %d, expected 0", s, version)
		require.Equal(t, p.String(), q.String(), "input: %q => phrase %q, expected %q", s, q.String(), p.String())
		require.False(t, len(q.InvalidWords()) > 0, "input: %q => phrase %q, contains invalid words %v", s, q.String(), q.InvalidWords())
	}

	// make a typo in one of the words
	w := strings.Fields(p.String())
	w[0] += "qx"
	x := strings.Join(w, " ")
	q := NewPaperKeyPhrase(x)

	// version should still be ok
	version, err := q.Version()
	require.NoError(t, err)
	require.Equal(t, 0, version, "input: %q => version: %d, expected 0", x, version)

	// but InvalidWords should return the first word as invalid
	require.NotEmpty(t, q.InvalidWords(), "input: %q => all words valid, expected %s to be invalid", x, w[0])

	require.Equal(t, w[0], q.InvalidWords()[0], "input: %q => invalid words %v, expected %s", x, q.InvalidWords(), w[0])
}
