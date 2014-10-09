package libkb

import (
	"github.com/keybase/go-jsonw"
)

type UID string

type User struct {
	// Raw JSON element read from the server or our local DB.
	basics       *jsonw.Wrapper
	public_keys  *jsonw.Wrapper
	sigs         *jsonw.Wrapper
	private_keys *jsonw.Wrapper

	// Processed fields
	id        UID
	sig_chain *SigChain
	id_table  *IdentityTable
}
