package stellar

import (
	"fmt"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func TestTimeCache(t *testing.T) {
	tc := libkb.SetupTest(t, "loaderclean", 1)
	defer tc.Cleanup()

	var a int
	c := NewTimeCache("xyz", 50, time.Minute)
	c.Put(tc.MetaContext(), "k", 1)
	ok := c.Get(tc.MetaContext(), "k", &a)
	require.True(t, ok)
	require.Equal(t, 1, a)

	fill2 := func() (interface{}, error) {
		return 2, nil
	}
	fillErr := func() (interface{}, error) {
		return 3, fmt.Errorf("eek")
	}
	err := c.GetWithFill(tc.MetaContext(), "l", &a, fill2)
	require.NoError(t, err)
	require.Equal(t, 2, a)
	err = c.GetWithFill(tc.MetaContext(), "l", &a, fillErr)
	require.NoError(t, err)
	require.Equal(t, 2, a)

	err = c.GetWithFill(tc.MetaContext(), "m", &a, fillErr)
	require.Error(t, err)
	require.Equal(t, 2, a)
}

func TestTimeCacheWrongType(t *testing.T) {
	tc := libkb.SetupTest(t, "loaderclean", 1)
	defer tc.Cleanup()

	var a int
	c := NewTimeCache("xyz", 50, time.Minute)
	c.Put(tc.MetaContext(), "k", "b")
	t.Logf("+ t1")
	ok := c.Get(tc.MetaContext(), "k", &a)
	require.False(t, ok)

	t.Logf("+ t2")
	c.Put(tc.MetaContext(), "k", "b")
	ok = c.Get(tc.MetaContext(), "k", a)
	require.False(t, ok)

	t.Logf("+ t3")
	c.Put(tc.MetaContext(), "k", "b")
	ok = c.Get(tc.MetaContext(), "k", "z")
	require.False(t, ok)
}

func TestTimeCacheWrongTypeStructs(t *testing.T) {
	tc := libkb.SetupTest(t, "loaderclean", 1)
	defer tc.Cleanup()

	type T1 struct{}
	type T2 struct{ y string }

	var a T1
	c := NewTimeCache("xyz", 50, time.Minute)
	c.Put(tc.MetaContext(), "k", T2{y: "b"})
	ok := c.Get(tc.MetaContext(), "k", &a)
	require.False(t, ok)
}
