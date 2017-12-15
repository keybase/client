// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"io"
	"testing"
)

const testText = `Loving in truth, and fain in verse my love to show
That she (dear She) might take some pleasure of my pain:
Pleasure might cause her read, reading might make her know,
Knowledge might pity win, and pity grace obtain;
I sought fit words to paint the blackest face of woe,
Studying inventions fine, her wits to entertain:
Oft turning others’ leaves, to see if thence would flow
Some fresh and fruitful showers upon my sun-burn’d brain.
But words came halting forth, wanting Invention’s stay,
Invention, Nature’s child, fled step-dame Study’s blows,
And others’ feet still seem’d but strangers in my way.
Thus, great with child to speak, and helpless in my throes,
Biting my truant pen, beating myself for spite--
“Fool,” said my Muse to me, “look in thy heart and write.”

Loving, and wishing to show my love in verse,
So that Stella might find pleasure in my pain,
So that pleasure might make her read, and reading make her know me,
And knowledge might win pity for me, and pity might obtain grace,
I looked for fitting words to depict the darkest face of sadness,
Studying clever creations in order to entertain her mind,
Often turning others’ pages to see if, from them,
Fresh and fruitful ideas would flow into my brain.
But words came out lamely, lacking the support of Imagination:
Imagination, nature’s child, fled the blows of Study, her stepmother:
And the writings (‘feet’) of others seemed only alien things in the way.
So while pregnant with the desire to speak, helpless with the birth pangs,
Biting at my pen which disobeyed me, beating myself in anger,
My Muse said to me ‘Fool, look in your heart and write.’
`

func TestPunctuatedReaderRegularReads(t *testing.T) {
	buf := bytes.NewBufferString(testText)
	r := newPunctuatedReader(buf, '.')
	for i := 0; i < 6; i++ {
		_, err := r.ReadUntilPunctuation(1024)
		if err != nil {
			t.Fatal(err)
		}
	}
	_, err := r.ReadUntilPunctuation(1024)
	if err != io.ErrUnexpectedEOF {
		t.Fatalf("Wrong error; wanted %v but got %v", io.ErrUnexpectedEOF, err)
	}
}

func TestPunctuatedReaderSlowReads(t *testing.T) {
	r := newPunctuatedReader(&slowReader{[]byte(testText)}, '.')
	for i := 0; i < 6; i++ {
		_, err := r.ReadUntilPunctuation(1024)
		if err != nil {
			t.Fatal(err)
		}
	}
	_, err := r.ReadUntilPunctuation(1024)
	if err != io.ErrUnexpectedEOF {
		t.Fatalf("Wrong error; wanted %v but got %v", io.ErrUnexpectedEOF, err)
	}
}

func TestPunctuatedReaderSlowReadsOverflow(t *testing.T) {
	r := newPunctuatedReader(&slowReader{[]byte(testText)}, '.')
	_, err := r.ReadUntilPunctuation(20)
	if err != ErrOverflow {
		t.Fatalf("Wrong error; wanted %v but got %v", ErrOverflow, err)
	}
}
