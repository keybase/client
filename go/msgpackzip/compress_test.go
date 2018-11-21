package msgpackzip

import (
	"bytes"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"github.com/stretchr/testify/require"
	"io/ioutil"
	"path/filepath"
	"testing"
)

type testVector struct {
	name   string
	data   string
	inFile bool
}

var vectors = []testVector{
	{
		"inbox-2",
		"g61jb252ZXJzYXRpb25zkYanZXhwdW5nZYKlYmFzaXMApHVwdG8Ar21heE1zZ1N1bW1hcmllc5KFpWN0aW1lzwAAAWbp7L/1q21lc3NhZ2VUeXBlAaVtc2dJRAKndGxmTmFtZap0ZXN0LHRlc3QxqXRsZlB1YmxpY8KFpWN0aW1lzwAAAWbp7L8wq21lc3NhZ2VUeXBlBqVtc2dJRAGndGxmTmFtZap0ZXN0LHRlc3QxqXRsZlB1YmxpY8KnbWF4TXNnc8CobWV0YWRhdGGNqmFjdGl2ZUxpc3SRxBAbTw6YUZcZmOcyB4VEyWsZp2FsbExpc3SSxBAbTw6YUZcZmOcyB4VEyWsZxBCfhtCBiEx9ZZov6qDFWtAZrmNvbnZlcnNhdGlvbklExCAAANGzkOwmkujKzkTl1HxTBvhpb5ZCNgE6/R5WXkpOSalleGlzdGVuY2UAqGlkVHJpcGxlg6V0bGZpZMQQg9mnw8NksSgbME8qTYp5JKd0b3BpY0lExBAfp8PZdZ2QR9u6l+IrYEAgqXRvcGljVHlwZQGrbWVtYmVyc1R5cGUCqXJlc2V0TGlzdMCmc3RhdHVzAKxzdXBlcnNlZGVkQnnAqnN1cGVyc2VkZXPAqHRlYW1UeXBlAKd2ZXJzaW9uzQJJqnZpc2liaWxpdHkCrW5vdGlmaWNhdGlvbnOCq2NoYW5uZWxXaWRlw6hzZXR0aW5nc4IBggHDAMMAggHDAMOqcmVhZGVySW5mb4SobWF4TXNnaWQCpW10aW1lzwAAAWbp7L/4qXJlYWRNc2dpZAKmc3RhdHVzAKpwYWdpbmF0aW9uhKRsYXN0w6RuZXh0xDCCoUPEIAAA0bOQ7CaS6MrOROXUfFMG+GlvlkI2ATr9HlZeSk5JoU3PAAABZunsv/ijbnVtAahwcmV2aW91c8QwgqFDxCAAANGzkOwmkujKzkTl1HxTBvhpb5ZCNgE6/R5WXkpOSaFNzwAAAWbp7L/4pHZlcnPNAkk=",
		false,
	},
	{
		"inbox-3-cropped",
		"inbox-3-cropped.b64",
		true,
	},
	{
		"thread-106",
		"thread-106.b64",
		true,
	},
	{
		"ints",
		"k4SjYWFhAaNiYmLMgaNjY2POAAEAAqRkZGRkzwAAAAEAAAADhKNhYWH/o2JiYtDYo2NjY9L//v/+o2RkZNP////+/////YOjYWFhgqNiYmLAo2NjY8OjZGRkkwECA6NlZWXC",
		false,
	},
	{
		"megatest",
		"megatest.b64",
		true,
	},
}

func loadTestVector(t *testing.T, tv testVector) []byte {
	var data string
	var err error
	if tv.inFile {
		path := filepath.Join("testdata", tv.data) // relative path
		raw, err := ioutil.ReadFile(path)
		data = string(raw)
		require.NoError(t, err)
	} else {
		data = tv.data
	}
	b, err := base64.StdEncoding.DecodeString(data)
	require.NoError(t, err)
	return b
}

func TestSimpleVectors(t *testing.T) {
	for _, v := range vectors {
		b := loadTestVector(t, v)
		test1(t, v.name, b)
	}
}

func test1(t *testing.T, name string, dat []byte) {
	out, err := Compress(dat)
	require.NoError(t, err)
	fmt.Printf("%s: %d -> %d\n", name, len(dat), len(out))
	dat2, err := Inflate(out)
	require.NoError(t, err)
	require.True(t, bytes.Equal(dat, dat2))
}

func TestReportValuesFrequencies(t *testing.T) {
	b := loadTestVector(t, vectors[2])
	v, err := ReportValuesFrequencies(b)
	require.NoError(t, err)
	for _, freq := range v {
		if freq.Freq < 2 {
			continue
		}
		var k string
		switch t := freq.Key.(type) {
		case BinaryMapKey:
			k = "b:" + hex.EncodeToString([]byte(string(t)))
		case string:
			k = t
		case int:
			k = fmt.Sprintf("%d", t)
		default:
			k = "nil"
		}
		fmt.Printf("%s\t%d\n", k, freq.Freq)
	}
}

func TestCompressWithWhitelist(t *testing.T) {
	d := func(s string) []byte {
		ret, _ := hex.DecodeString(s)
		return ret
	}

	// This white list was devined using the above test, TestReportValuesFrequencies
	wl := NewValueWhitelist()
	wl.AddString("team1")
	wl.AddBinary(d("6fb1e234cad5e24be2fa84809ef0d518"))
	wl.AddBinary(d("1b4f0e9851971998e732078544c96b19"))
	wl.AddBinary(d("4a8d6e318170eef7233b6cccedf8d1dea4828fbca1c6d5fe279d4be13994d50c0e0c7b655655a9188a6eaf73a90198ec643c4ea66f68ac46a1eaea7ba2489ee1"))
	wl.AddBinary(d("2b38d80c7fb55c8001754c0559f7d520"))
	wl.AddBinary(d("57601e2c28b9a72eb7aa95559c096c24"))
	wl.AddBinary(d("01209647b483afa8f6c0a2c79dd5aa86660250a2ad8370cf9dcaf3edb35572bf973c0a"))

	b := loadTestVector(t, vectors[2])
	out, err := CompressWithWhitelist(b, *wl)
	require.NoError(t, err)
	fmt.Printf("compressed t106: %d -> %d\n", len(b), len(out))
	dat2, err := Inflate(out)
	require.NoError(t, err)
	require.True(t, bytes.Equal(b, dat2))
}
