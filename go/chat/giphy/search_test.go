package giphy

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGiphySearch(t *testing.T) {
	res, err := Search(context.TODO(), nil)
	require.NoError(t, err)
	require.NotZero(t, len(res))
	t.Logf("%#v", res)
}
