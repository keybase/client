package jsonparserw

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestHappyPath(t *testing.T) {
	jsonBlob := []byte("{\"foo\": 1, \"bar\": true, \"baz\": \"bing\"}")

	foo, err := GetInt(jsonBlob, "foo")
	require.NoError(t, err)
	require.Equal(t, int64(1), foo)

	bar, err := GetBoolean(jsonBlob, "bar")
	require.NoError(t, err)
	require.True(t, bar)

	baz, err := GetString(jsonBlob, "baz")
	require.NoError(t, err)
	require.Equal(t, "bing", baz)
}

func TestDescriptiveErrorMessage(t *testing.T) {
	jsonBlob := []byte("{\"raimbaut\": \"roussillon\", \"bradamante\": \"aedificium\"}")
	_, err := GetString(jsonBlob, "agilulf", "bertrandin", "guildivern", "corbentraz")

	// Should not include data to avoid leaking sensitive information in log sends
	require.NotContains(t, err.Error(), "raimbaut")

	// Should include keys
	require.Contains(t, err.Error(), "with keys [agilulf bertrandin guildivern corbentraz]")

	// Should include original error message
	require.Contains(t, err.Error(), "Key path not found")
}
