package libkb

import (
	"path/filepath"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
)

type JSONTestFile struct {
	*JSONFile
}

type JSONTestReader interface {
	JSONReader
}
type JSONTestWriter interface {
	JSONWriter
}

func TestJsonTransaction(t *testing.T) {
	tc := SetupTest(t, "json", 1)
	defer tc.Cleanup()

	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			tx, err := tc.G.Env.GetConfigWriter().BeginTransaction()
			if err == nil {
				tx.Abort()
			}
			wg.Done()
		}()
	}
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			tx, err := tc.G.Env.GetConfigWriter().BeginTransaction()
			if err == nil {
				tx.Commit()
			}
			wg.Done()
		}()
	}
	wg.Wait()
}

func buildNewJSONFile(m MetaContext) (JSONTestReader, JSONTestWriter, *JSONTestFile) {
	path := filepath.Join(m.G().Env.GetConfigDir(), "test-json-file")
	jsonFile := JSONTestFile{NewJSONFile(m.G(), path, "device clone state")}
	jsonFile.Load(false)
	return &jsonFile, &jsonFile, &jsonFile
}

func TestJsonSetAndGetString(t *testing.T) {
	tc := SetupTest(t, "json", 1)
	defer tc.Cleanup()
	m := NewMetaContextForTest(tc)
	reader, writer, rawFile := buildNewJSONFile(m)
	defer rawFile.Nuke()

	//verify that the path is empty first
	path := "america.montana.bozeman"
	value := "The American Computer Museum"
	firstRead, isRet := reader.GetStringAtPath(path)
	require.False(tc.T, isRet)
	require.Equal(tc.T, firstRead, "")

	//set, get, inspect
	err := writer.SetStringAtPath(path, value)
	require.NoError(tc.T, err)
	secondRead, isRet := reader.GetStringAtPath(path)
	require.True(tc.T, isRet)
	require.Equal(tc.T, secondRead, value)
}

func TestJsonSetAndGetInt(t *testing.T) {
	tc := SetupTest(t, "json", 1)
	defer tc.Cleanup()
	m := NewMetaContextForTest(tc)
	reader, writer, rawFile := buildNewJSONFile(m)
	defer rawFile.Nuke()

	//verify that the path is empty first
	path := "candy.skittles.count"
	value := 12
	firstRead, isRet := reader.GetIntAtPath(path)
	require.False(tc.T, isRet)
	require.Equal(tc.T, firstRead, 0)

	//set, get, inspect
	err := writer.SetIntAtPath(path, value)
	require.NoError(tc.T, err)
	secondRead, isRet := reader.GetIntAtPath(path)
	require.True(tc.T, isRet)
	require.Equal(tc.T, secondRead, value)
}

func TestJsonSetAndGetBool(t *testing.T) {
	tc := SetupTest(t, "json", 1)
	defer tc.Cleanup()
	m := NewMetaContextForTest(tc)
	reader, writer, rawFile := buildNewJSONFile(m)
	defer rawFile.Nuke()

	//verify that the path is empty first
	path := "colors.orange.appetizing"
	value := true
	firstRead, isRet := reader.GetBoolAtPath(path)
	require.False(tc.T, isRet)
	require.Equal(tc.T, firstRead, false)

	//set, get, inspect
	err := writer.SetBoolAtPath(path, value)
	require.NoError(tc.T, err)
	secondRead, isRet := reader.GetBoolAtPath(path)
	require.True(tc.T, isRet)
	require.True(tc.T, secondRead)
}

func TestJsonSetAndGetNull(t *testing.T) {
	tc := SetupTest(t, "json", 1)
	defer tc.Cleanup()
	m := NewMetaContextForTest(tc)
	reader, writer, rawFile := buildNewJSONFile(m)
	defer rawFile.Nuke()

	//verify that the path is empty first
	//and that GetNull knows the path wasn't set
	path := "worldcup.victories.croatia"
	value := 2018
	isRet := reader.GetNullAtPath(path)
	require.False(tc.T, isRet)

	//set, get, inspect
	_ = writer.SetIntAtPath(path, value)
	secondRead, _ := reader.GetIntAtPath(path)
	require.Equal(tc.T, secondRead, value)
	// null it out and verify
	err := writer.SetNullAtPath(path)
	require.NoError(tc.T, err)
	isRet = reader.GetNullAtPath(path)
	require.True(tc.T, isRet)
}
