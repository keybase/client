package basex

import (
	"encoding/base64"
	"testing"
)

const encodeURL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

func newBase64URLEncoding() *Encoding {
	return NewEncoding(encodeURL, 3, "")
}

func TestHelloWorld(t *testing.T) {
	encoding := newBase64URLEncoding()
	input := []byte("Hello world! It is I, Bubba Karp!")
	for nTextBytes := 0; nTextBytes <= len(input); nTextBytes++ {
		for nPadBytes := 0; nPadBytes <= 20; nPadBytes++ {
			pad := make([]byte, nPadBytes)
			paddedInput := append(pad, input[0:nTextBytes]...)
			output := make([]byte, encoding.EncodedLen(len(paddedInput)))
			encoding.Encode(output, paddedInput)
			ours := string(output)
			theirs := base64.RawURLEncoding.EncodeToString(paddedInput)
			if ours != theirs {
				t.Fatalf("Failed on input '%s': %s != %s", paddedInput, ours, theirs)
			}
			roundTrip := make([]byte, encoding.DecodedLen(len(output)))
			encoding.Decode(roundTrip, output)
			if string(roundTrip) != string(paddedInput) {
				t.Fatalf("Decoding error: %s != %s", string(roundTrip), string(paddedInput))
			}
		}
	}
}
