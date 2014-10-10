package libkb

import (
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
func (j *JsonLocalDb) Unlink() error        { return j.engine.Unlink() }

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
	DB_USER = 0x0
	DB_SIG  = 0x0f
)

const (
	DB_LOOKUP_USERNAME = 0x00
)
