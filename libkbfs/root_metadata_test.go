package libkbfs

import (
	"sort"
	"testing"

	"github.com/keybase/client/go/protocol"
	"github.com/stretchr/testify/require"
)

// Test that GetTlfHandle() generates a TlfHandle properly for public
// TLFs if there is no cached TlfHandle.
func TestRootMetadataGetTlfHandlePublic(t *testing.T) {
	tlfID := FakeTlfID(0, true)
	rmd := NewRootMetadata(nil, tlfID)
	dirHandle := rmd.GetTlfHandle()
	if dirHandle == nil {
		t.Fatal("nil TlfHandle")
	}
	if len(dirHandle.Readers) != 1 || dirHandle.Readers[0] != keybase1.PublicUID {
		t.Errorf("Invalid reader list %v", dirHandle.Readers)
	}
	if len(dirHandle.Writers) != 0 {
		t.Errorf("Invalid writer list %v", dirHandle.Writers)
	}
}

// Test that GetTlfHandle() generates a TlfHandle properly for
// non-public TLFs if there is no cached TlfHandle.
func TestRootMetadataGetTlfHandlePrivate(t *testing.T) {
	tlfID := FakeTlfID(0, false)
	rmd := NewRootMetadata(nil, tlfID)
	AddNewKeysOrBust(t, rmd, *NewTLFKeyBundle())
	dirHandle := rmd.GetTlfHandle()
	if dirHandle == nil {
		t.Fatal("nil TlfHandle")
	}
	if len(dirHandle.Readers) != 0 {
		t.Errorf("Invalid reader list %v", dirHandle.Readers)
	}
	if len(dirHandle.Writers) != 0 {
		t.Errorf("Invalid writer list %v", dirHandle.Writers)
	}
}

// Test that key generations work as expected for private TLFs.
func TestRootMetadataLatestKeyGenerationPrivate(t *testing.T) {
	tlfID := FakeTlfID(0, false)
	rmd := NewRootMetadata(nil, tlfID)
	if rmd.LatestKeyGeneration() != 0 {
		t.Errorf("Expected key generation to be invalid (0)")
	}
	AddNewKeysOrBust(t, rmd, *NewTLFKeyBundle())
	if rmd.LatestKeyGeneration() != FirstValidKeyGen {
		t.Errorf("Expected key generation to be valid(%d)", FirstValidKeyGen)
	}
}

// Test that key generations work as expected for public TLFs.
func TestRootMetadataLatestKeyGenerationPublic(t *testing.T) {
	tlfID := FakeTlfID(0, true)
	rmd := NewRootMetadata(nil, tlfID)
	if rmd.LatestKeyGeneration() != PublicKeyGen {
		t.Errorf("Expected key generation to be public (%d)", PublicKeyGen)
	}
}

// Test that old encoded WriterMetadata objects (i.e., without any
// extra fields) can be deserialized and serialized to the same form,
// which is important for RootMetadata.VerifyWriterMetadata().
func TestWriterMetadataUnchangedEncoding(t *testing.T) {
	encodedWm := []byte{
		0x89, 0xa3, 0x42, 0x49, 0x44, 0xc4, 0x10, 0x0,
		0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
		0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0xa9,
		0x44, 0x69, 0x73, 0x6b, 0x55, 0x73, 0x61, 0x67,
		0x65, 0x64, 0xa2, 0x49, 0x44, 0xc4, 0x10, 0x1,
		0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
		0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x16, 0xb3,
		0x4c, 0x61, 0x73, 0x74, 0x4d, 0x6f, 0x64, 0x69,
		0x66, 0x79, 0x69, 0x6e, 0x67, 0x57, 0x72, 0x69,
		0x74, 0x65, 0x72, 0xa4, 0x75, 0x69, 0x64, 0x31,
		0xa8, 0x52, 0x65, 0x66, 0x42, 0x79, 0x74, 0x65,
		0x73, 0x63, 0xaa, 0x55, 0x6e, 0x72, 0x65, 0x66,
		0x42, 0x79, 0x74, 0x65, 0x73, 0x65, 0xa6, 0x57,
		0x46, 0x6c, 0x61, 0x67, 0x73, 0xa, 0xa7, 0x57,
		0x72, 0x69, 0x74, 0x65, 0x72, 0x73, 0x92, 0xa4,
		0x75, 0x69, 0x64, 0x31, 0xa4, 0x75, 0x69, 0x64,
		0x32, 0xa4, 0x64, 0x61, 0x74, 0x61, 0xc4, 0x2,
		0xa, 0xb,
	}

	expectedWm := WriterMetadata{
		SerializedPrivateMetadata: []byte{0xa, 0xb},
		LastModifyingWriter:       "uid1",
		Writers:                   []keybase1.UID{"uid1", "uid2"},
		ID:                        FakeTlfID(1, false),
		BID:                       NullBranchID,
		WFlags:                    0xa,
		DiskUsage:                 100,
		RefBytes:                  99,
		UnrefBytes:                101,
	}

	c := NewCodecMsgpack()

	var wm WriterMetadata
	err := c.Decode(encodedWm, &wm)
	require.Nil(t, err)

	require.Equal(t, expectedWm, wm)

	buf, err := c.Encode(wm)
	require.Nil(t, err)
	require.Equal(t, encodedWm, buf)
}

// Test that WriterMetadata has only a fixed (frozen) set of fields.
func TestWriterMetadataEncodedFields(t *testing.T) {
	// Usually exactly one of Writers/WKeys is filled in, but we
	// fill in both here for testing.
	wm := WriterMetadata{
		Writers: []keybase1.UID{"uid1", "uid2"},
		WKeys:   TLFWriterKeyGenerations{nil},
		Extra:   &WriterMetadataExtra{},
	}

	c := NewCodecMsgpack()

	buf, err := c.Encode(wm)
	require.Nil(t, err)

	var m map[string]interface{}
	err = c.Decode(buf, &m)
	require.Nil(t, err)

	expectedFields := []string{
		"BID",
		"DiskUsage",
		"ID",
		"LastModifyingWriter",
		"RefBytes",
		"UnrefBytes",
		"WFlags",
		"WKeys",
		"Writers",
		"data",
		"x",
	}

	var fields []string
	for field := range m {
		fields = append(fields, field)
	}
	sort.Strings(fields)
	require.Equal(t, expectedFields, fields)
}

type writerMetadataUnknownFieldTest struct {
	t *testing.T
}

var _ structUnknownFieldsTest = writerMetadataUnknownFieldTest{}

func (writerMetadataUnknownFieldTest) makeEmptyStruct() interface{} {
	return WriterMetadata{}
}

func (t writerMetadataUnknownFieldTest) makeFilledStruct() interface{} {
	return WriterMetadata{
		SerializedPrivateMetadata: []byte{0xa, 0xb},
		LastModifyingWriter:       "uid1",
		Writers:                   []keybase1.UID{"uid1", "uid2"},
		ID:                        FakeTlfID(1, false),
		BID:                       NullBranchID,
		WFlags:                    0xa,
		DiskUsage:                 100,
		RefBytes:                  99,
		UnrefBytes:                101,
	}
}

func (writerMetadataUnknownFieldTest) filterKnownFields(i interface{}) interface{} {
	s := i.(WriterMetadata)
	// Once we add fields to Extra, we'll have to change this to
	// keep them.
	s.Extra = nil
	return s
}

type writerMetadataExtraFuture struct {
	WriterMetadataExtra
	extra
}

type writerMetadataFuture struct {
	WriterMetadata
	// Override WriterMetadata.Extra.
	Extra *writerMetadataExtraFuture `codec:"x,omitempty"`
}

func (writerMetadataUnknownFieldTest) makeEmptyFutureStruct() interface{} {
	return writerMetadataFuture{}
}

func (t writerMetadataUnknownFieldTest) makeFilledFutureStruct() interface{} {
	return writerMetadataFuture{
		WriterMetadata: t.makeFilledStruct().(WriterMetadata),
		Extra: &writerMetadataExtraFuture{
			WriterMetadataExtra: WriterMetadataExtra{},
			extra:               makeExtraOrBust(t.t),
		},
	}
}

func TestWriterMetadataUnknownFields(t *testing.T) {
	testStructUnknownFields(t, writerMetadataUnknownFieldTest{t})
}
