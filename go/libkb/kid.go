package libkb

import (
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"strings"

	"github.com/agl/ed25519"
	jsonw "github.com/keybase/go-jsonw"
)

type KID []byte

func (k KID) Match(q string, exact bool) bool {
	if k == nil {
		return false
	}

	if exact {
		return strings.ToLower(k.String()) == strings.ToLower(q)
	}

	if strings.HasPrefix(k.String(), strings.ToLower(q)) {
		return true
	}
	if strings.HasPrefix(k.ToShortIDString(), q) {
		return true
	}
	return false
}

func (k KID) ToFOKID() FOKID {
	return FOKID{Kid: k}
}

func (k KID) ToMapKey() KIDMapKey {
	return KIDMapKey(k.String())
}

func (k KID) ToFOKIDMapKey() FOKIDMapKey {
	return FOKIDMapKey(k.ToMapKey())
}

func (k KID) ToShortIDString() string {
	return strings.TrimRight(base64.URLEncoding.EncodeToString(k[0:12]), "=")
}

func (k KID) String() string {
	return hex.EncodeToString(k)
}

func (k KID) IsValid() bool {
	return k != nil && len(k) > 0
}

func (k KID) MarshalJSON() ([]byte, error) {
	return json.Marshal(k.String())
}

func (k *KID) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	kid, err := ImportKID(s)
	if err != nil {
		return err
	}
	*k = kid
	return nil
}

func (k KID) ToJsonw() *jsonw.Wrapper {
	if k == nil {
		return jsonw.NewNil()
	}
	return jsonw.NewString(k.String())
}

func (k KID) ToBytes() []byte {
	return []byte(k)
}

func (k KID) Eq(k2 KID) bool {
	return SecureByteArrayEq([]byte(k), []byte(k2))
}

// XXX why is this a function on the KID type???
func (k KID) LoadPGPKeyFromLocalDB() (*PGPKeyBundle, error) {
	dbobj, err := G.LocalDb.Get(DbKey{
		Typ: DBPGPKey,
		Key: k.String(),
	})
	if err != nil {
		return nil, err
	}
	if dbobj == nil {
		return nil, nil
	}
	return GetOneKey(dbobj)
}

func (k KID) ToNaclSigningKeyPublic() *NaclSigningKeyPublic {
	if len(k) != 3+ed25519.PublicKeySize {
		return nil
	}
	if k[0] != byte(KeybaseKIDV1) || k[1] != byte(KIDNaclEddsa) ||
		k[len(k)-1] != byte(IDSuffixKID) {
		return nil
	}
	var ret NaclSigningKeyPublic
	copy(ret[:], k[2:len(k)-1])
	return &ret
}

func ImportKID(s string) (ret KID, err error) {
	var tmp []byte
	if tmp, err = hex.DecodeString(s); err == nil && len(tmp) > 0 {
		ret = KID(tmp)
	}
	return
}

func GetKID(w *jsonw.Wrapper) (kid KID, err error) {
	var s string
	if s, err = w.GetString(); err == nil && len(s) > 0 {
		kid, err = ImportKID(s)
	}
	return
}

// Remove the need for the KIDMapKey type. See
// https://github.com/keybase/client/issues/413 .
type KIDMapKey string

func (key KIDMapKey) ToKID() (KID, error) {
	return ImportKID(string(key))
}
