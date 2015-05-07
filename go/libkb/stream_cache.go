package libkb

import (
	triplesec "github.com/keybase/go-triplesec"
)

type StreamCache struct {
	tsec             *triplesec.Cipher
	passphraseStream PassphraseStream
}
