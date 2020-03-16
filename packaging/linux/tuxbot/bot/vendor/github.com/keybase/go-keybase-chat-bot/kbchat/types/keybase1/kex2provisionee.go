// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/kex2provisionee.avdl

package keybase1

type PassphraseStream struct {
	PassphraseStream []byte `codec:"passphraseStream" json:"passphraseStream"`
	Generation       int    `codec:"generation" json:"generation"`
}

func (o PassphraseStream) DeepCopy() PassphraseStream {
	return PassphraseStream{
		PassphraseStream: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.PassphraseStream),
		Generation: o.Generation,
	}
}

type SessionToken string

func (o SessionToken) DeepCopy() SessionToken {
	return o
}

type CsrfToken string

func (o CsrfToken) DeepCopy() CsrfToken {
	return o
}

type HelloRes string

func (o HelloRes) DeepCopy() HelloRes {
	return o
}
