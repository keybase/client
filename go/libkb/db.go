package libkb

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

func (k DbKey) ToString(table string) string {
	return fmt.Sprintf("%s:%02x:%s", table, k.Typ, k.Key)
}

func (k DbKey) ToBytes(table string) []byte {
	return []byte(k.ToString(table))
}

var fieldExp *regexp.Regexp

func init() {
	fieldExp = regexp.MustCompile(`[a-f0-9]{2}`)
}

func DbKeyParse(s string) (string, *DbKey, error) {
	v := strings.Split(s, ":")
	if len(v) != 3 {
		return "", nil, fmt.Errorf("expected 3 colon-separated fields")
	}

	if !fieldExp.MatchString(v[1]) {
		return "", nil, fmt.Errorf("2nd field should be a 1-byte hex string")
	}

	b, err := strconv.ParseUint(v[1], 16, 8)
	if err != nil {
		return "", nil, err
	}
	return v[0], &DbKey{ObjType(b), v[2]}, nil
}

type JSONLocalDb struct {
	engine LocalDb
}

func NewJSONLocalDb(e LocalDb) *JSONLocalDb { return &JSONLocalDb{e} }
func (j *JSONLocalDb) Open() error          { return j.engine.Open() }
func (j *JSONLocalDb) ForceOpen() error     { return j.engine.ForceOpen() }
func (j *JSONLocalDb) Close() error         { return j.engine.Close() }
func (j *JSONLocalDb) Nuke() error          { return j.engine.Nuke() }

func (j *JSONLocalDb) Put(id DbKey, aliases []DbKey, val *jsonw.Wrapper) error {
	bytes, err := val.Marshal()
	if err == nil {
		err = j.engine.Put(id, aliases, bytes)
	}
	return err
}

func (j *JSONLocalDb) Get(id DbKey) (*jsonw.Wrapper, error) {
	bytes, found, err := j.engine.Get(id)
	var ret *jsonw.Wrapper
	if found {
		ret, err = jsonw.Unmarshal(bytes)
	}
	return ret, err
}

func (j *JSONLocalDb) GetInto(obj interface{}, id DbKey) (found bool, err error) {
	var buf []byte
	buf, found, err = j.engine.Get(id)
	if err == nil && found {
		err = json.Unmarshal(buf, &obj)
	}
	return
}

func (j *JSONLocalDb) PutObj(id DbKey, aliases []DbKey, obj interface{}) (err error) {
	var bytes []byte
	bytes, err = json.Marshal(obj)
	if err == nil {
		err = j.engine.Put(id, aliases, bytes)
	}
	return err
}

func (j *JSONLocalDb) Lookup(id DbKey) (*jsonw.Wrapper, error) {
	bytes, found, err := j.engine.Lookup(id)
	var ret *jsonw.Wrapper
	if found {
		ret, err = jsonw.Unmarshal(bytes)
	}
	return ret, err
}

func (j *JSONLocalDb) Delete(id DbKey) error { return j.engine.Delete(id) }

const (
	DB_USER                       = 0x00
	DB_SIG                        = 0x0f
	DB_LINK                       = 0xe0
	DB_LOCAL_TRACK                = 0xe1
	DB_PGP_KEY                    = 0xe3
	DB_SIG_HINTS                  = 0xe4
	DB_PROOF_CHECK                = 0xe5
	DB_USER_SECRET_KEYS           = 0xe6
	DB_SIG_CHAIN_TAIL_PUBLIC      = 0xe7
	DB_SIG_CHAIN_TAIL_SEMIPRIVATE = 0xe8
	DB_SIG_CHAIN_TAIL_ENCRYPTED   = 0xe9
	DB_MERKLE_ROOT                = 0xf0
	DB_TRACKERS                   = 0xf1
)

const (
	DB_LOOKUP_USERNAME    = 0x00
	DB_LOOKUP_MERKLE_ROOT = 0x01
)

func DbKeyUID(t ObjType, uid keybase1.UID) DbKey {
	return DbKey{Typ: t, Key: uid.String()}
}
