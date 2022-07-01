package jsonhelpers

import (
	"fmt"
	"log"
	"sort"
	"testing"

	jsonw "github.com/keybase/go-jsonw"
	"github.com/stretchr/testify/require"
)

func makeJSONDangerous(json string) *jsonw.Wrapper {
	w, err := jsonw.Unmarshal([]byte(json))
	if err != nil {
		log.Panic(err)
	}
	return w
}

type jsonStringSimpleTest struct {
	shouldWork bool
	json       *jsonw.Wrapper
	out        string
}

var jsonStringSimpleTests = []jsonStringSimpleTest{
	{true, makeJSONDangerous("1"), "1"},
	{true, makeJSONDangerous(`"hey"`), "hey"},
	{true, makeJSONDangerous("true"), "true"},
	{true, makeJSONDangerous("false"), "false"},
	{false, makeJSONDangerous("null"), ""},
	{false, makeJSONDangerous(`{"a": "b", "1": 2}`), ""},
	{false, makeJSONDangerous(`[1, {"a": "b"}, "three"]`), ""},
}

func TestJSONStringSimple(t *testing.T) {
	for _, test := range jsonStringSimpleTests {
		out, err := JSONStringSimple(test.json)
		if test.shouldWork {
			require.NoError(t, err)
			require.Equal(t, test.out, out)
		} else {
			require.Error(t, err)
		}
	}
}

func TestPyindex(t *testing.T) {
	tests := []struct {
		index int
		len   int
		x     int
		ok    bool
	}{
		{0, 0, 0, false},
		{0, -1, 0, false},
		{0, 4, 0, true},
		{3, 4, 3, true},
		{4, 4, 0, false},
		{5, 4, 0, false},
		{-1, 4, 3, true},
		{-2, 4, 2, true},
		{-4, 4, 0, true},
		{-5, 4, 0, false},
	}

	for _, test := range tests {
		x, ok := pyindex(test.index, test.len)
		if test.ok {
			require.True(t, ok)
			require.Equal(t, test.x, x)
		} else {
			require.False(t, ok)
		}
	}
}

type jsonUnpackArrayTest struct {
	json       *jsonw.Wrapper
	shouldWork bool
	out        []*jsonw.Wrapper
}

var jsonUnpackArrayTests = []jsonUnpackArrayTest{
	{makeJSONDangerous("1"), false, nil},
	{makeJSONDangerous(`"hey"`), false, nil},
	{makeJSONDangerous(`{"a": "b"}`), false, nil},
	{makeJSONDangerous(`[1, {"a": "b"}, "three"]`), true, []*jsonw.Wrapper{
		makeJSONDangerous(`1`), makeJSONDangerous(`{"a": "b"}`), makeJSONDangerous(`"three"`),
	}},
}

func TestJSONUnpackArray(t *testing.T) {
	for _, test := range jsonUnpackArrayTests {
		arr, err := jsonUnpackArray(test.json)
		if test.shouldWork {
			require.NoError(t, err)
		} else {
			require.Error(t, err)
		}
		require.Equal(t, len(test.out), len(arr))

		for j, x := range arr {
			y := test.out[j]
			a, err := x.Marshal()
			require.NoError(t, err)

			b, err := y.Marshal()
			require.NoError(t, err)
			require.Equal(t, a, b)
		}
	}
}

type jsonGetChildrenTest struct {
	json       *jsonw.Wrapper
	shouldWork bool
	out        []*jsonw.Wrapper
}

var jsonGetChildrenTests = []jsonGetChildrenTest{
	{makeJSONDangerous("1"), false, nil},
	{makeJSONDangerous(`"hey"`), false, nil},
	{makeJSONDangerous(`{"a": "b", "1": 2}`), true, []*jsonw.Wrapper{
		makeJSONDangerous(`"b"`), makeJSONDangerous(`2`),
	}},
	{makeJSONDangerous(`[1, {"a": "b"}, "three"]`), true, []*jsonw.Wrapper{
		makeJSONDangerous(`1`), makeJSONDangerous(`{"a": "b"}`), makeJSONDangerous(`"three"`),
	}},
}

func compareJSONStringLists(xs, ys []*jsonw.Wrapper) error {
	a1, err := getJSONStringList(xs)
	if err != nil {
		return err
	}
	a2, err := getJSONStringList(ys)
	if err != nil {
		return err
	}
	sort.Strings(a1)
	sort.Strings(a2)
	if len(a1) != len(a2) {
		return fmt.Errorf("lists differ in length %v %v", len(a1), len(a2))
	}
	for i, s1 := range a1 {
		s2 := a2[i]
		if s1 != s2 {
			return fmt.Errorf("element [%v] differ\n%v\n%v", i, s1, s2)
		}
	}
	return nil
}

func getJSONStringList(xs []*jsonw.Wrapper) ([]string, error) {
	var ret []string
	for _, x := range xs {
		b, err := x.Marshal()
		if err != nil {
			return nil, err
		}
		ret = append(ret, string(b))
	}
	return ret, nil
}

func TestJSONGetChildren(t *testing.T) {
	for _, test := range jsonGetChildrenTests {
		arr, err := JSONGetChildren(test.json)
		if test.shouldWork {
			require.NoError(t, err)
		} else {
			require.Error(t, err)
		}
		require.Equal(t, len(test.out), len(arr))

		err = compareJSONStringLists(arr, test.out)
		require.NoError(t, err)
	}
}
