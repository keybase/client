// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	keybase1 "github.com/keybase/client/go/protocol"
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
func (j *JSONLocalDb) Nuke() (string, error) {
	fn, err := j.engine.Nuke()
	return fn, err
}

func (j *JSONLocalDb) Put(id DbKey, aliases []DbKey, val *jsonw.Wrapper) error {
	bytes, err := val.Marshal()
	if err == nil {
		err = j.engine.Put(id, aliases, bytes)
	}
	return err
}

func (j *JSONLocalDb) PutRaw(id DbKey, b []byte) error {
	return j.engine.Put(id, nil, b)
}

func (j *JSONLocalDb) GetRaw(id DbKey) ([]byte, bool, error) {
	return j.engine.Get(id)
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
	DBUser                    = 0x00
	DBSig                     = 0x0f
	DBLink                    = 0xe0
	DBLocalTrack              = 0xe1
	DBPGPKey                  = 0xe3
	DBSigHints                = 0xe4
	DBProofCheck              = 0xe5
	DBUserSecretKeys          = 0xe6
	DBSigChainTailPublic      = 0xe7
	DBSigChainTailSemiprivate = 0xe8
	DBSigChainTailEncrypted   = 0xe9
	DBMerkleRoot              = 0xf0
	DBTrackers                = 0xf1
	DBGregor                  = 0xf2
	DBTrackers2               = 0xf3
	DBTrackers2Reverse        = 0xf4
)

const (
	DBLookupUsername   = 0x00
	DBLookupMerkleRoot = 0x01
)

func DbKeyUID(t ObjType, uid keybase1.UID) DbKey {
	return DbKey{Typ: t, Key: uid.String()}
}
