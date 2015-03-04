package libkb

import (
	"encoding/json"
	"fmt"
	"github.com/keybase/go-jsonw"
	"regexp"
	"strconv"
	"strings"
)

func (k DbKey) ToString(table string) string {
	return fmt.Sprintf("%s:%02x:%s", table, k.Typ, k.Key)
}

func (k DbKey) ToBytes(table string) []byte {
	return []byte(k.ToString(table))
}

func DbKeyParse(s string) (string, *DbKey, error) {
	v := strings.Split(s, ":")
	re := regexp.MustCompile(`[a-f0-9]{2}`)
	if len(v) != 3 {
		return "", nil, fmt.Errorf("expected 3 colon-separated fields")
	} else if !re.MatchString(v[1]) {
		return "", nil, fmt.Errorf("2nd field should be a 1-byte hex string")
	} else if b, err := strconv.ParseUint(v[1], 16, 8); err != nil {
		return "", nil, err
	} else {
		return v[0], &DbKey{ObjType(b), v[2]}, nil
	}
}

type JsonLocalDb struct {
	engine LocalDb
}

func NewJsonLocalDb(e LocalDb) *JsonLocalDb { return &JsonLocalDb{e} }
func (j *JsonLocalDb) Open() error          { return j.engine.Open() }
func (j *JsonLocalDb) Close() error         { return j.engine.Close() }
func (j *JsonLocalDb) Nuke() error          { return j.engine.Nuke() }

func (j *JsonLocalDb) Put(id DbKey, aliases []DbKey, val *jsonw.Wrapper) error {
	bytes, err := val.Marshal()
	if err == nil {
		err = j.engine.Put(id, aliases, bytes)
	}
	return err
}

func (j *JsonLocalDb) Get(id DbKey) (*jsonw.Wrapper, error) {
	bytes, found, err := j.engine.Get(id)
	var ret *jsonw.Wrapper
	if found {
		ret, err = jsonw.Unmarshal(bytes)
	}
	return ret, err
}

func (j *JsonLocalDb) GetInto(obj interface{}, id DbKey) (found bool, err error) {
	var buf []byte
	buf, found, err = j.engine.Get(id)
	if err == nil && found {
		err = json.Unmarshal(buf, &obj)
	}
	return
}

func (j *JsonLocalDb) PutObj(id DbKey, aliases []DbKey, obj interface{}) (err error) {
	var bytes []byte
	bytes, err = json.Marshal(obj)
	if err == nil {
		err = j.engine.Put(id, aliases, bytes)
	}
	return err
}

func (j *JsonLocalDb) Lookup(id DbKey) (*jsonw.Wrapper, error) {
	bytes, found, err := j.engine.Lookup(id)
	var ret *jsonw.Wrapper
	if found {
		ret, err = jsonw.Unmarshal(bytes)
	}
	return ret, err
}

func (j *JsonLocalDb) Delete(id DbKey) error { return j.engine.Delete(id) }

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
