package libkb

import (
	"fmt"
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
