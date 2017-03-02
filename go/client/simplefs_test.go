package client

import (
	"errors"
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

/*
 file source cases:
 1. file
 2. dir

 file source/dest types:
 1. kbfs
 2. local

 file dest cases:
 1. file
 2. dir
 3. not found
*/

func TestSimpleFSPathRemote(t *testing.T) {
	tc := libkb.SetupTest(t, "simplefs_path", 0)

	testPath := makeSimpleFSPath(tc.G, "/keybase/private/foobar")
	pathType, err := testPath.PathType()
	require.NoError(tc.T, err, "bad path type")
	assert.Equal(tc.T, keybase1.PathType_KBFS, pathType, "Expected remote path, got local")
	assert.Equal(tc.T, "/private/foobar", testPath.Kbfs())

	testPath = makeSimpleFSPath(tc.G, "/keybase/private/")
	pathType, err = testPath.PathType()
	require.NoError(tc.T, err, "bad path type")
	assert.Equal(tc.T, keybase1.PathType_KBFS, pathType, "Expected remote path, got local")
	assert.Equal(tc.T, "/private/", testPath.Kbfs())

}

func TestSimpleFSPathLocal(t *testing.T) {
	tc := libkb.SetupTest(t, "simplefs_path", 0)

	testPath := makeSimpleFSPath(tc.G, "./foobar")
	pathType, err := testPath.PathType()
	require.NoError(tc.T, err, "bad path type")
	assert.Equal(tc.T, keybase1.PathType_LOCAL, pathType, "Expected local path, got remote")
}

// CmdSimpleFSGetStatus is the 'fs get-status' command.
type SimpleFSTestStat struct {
	remoteExists bool
	localExists  bool
}

func (s SimpleFSTestStat) SimpleFSStat(_ context.Context, path keybase1.Path) (keybase1.Dirent, error) {
	pathString := pathToString(path)
	entType := keybase1.DirentType_DIR
	// For a quick test, assume it's a file if there is a dot and 3 chars at the end
	if len(filepath.Ext(filepath.Base(pathString))) == 4 {
		entType = keybase1.DirentType_FILE
	}
	pathType, _ := path.PathType()
	if (pathType == keybase1.PathType_KBFS && s.remoteExists == true) ||
		(pathType == keybase1.PathType_LOCAL && s.localExists == true) {
		return keybase1.Dirent{
			Name:       pathString,
			DirentType: entType,
		}, nil
	}
	return keybase1.Dirent{}, errors.New(pathString + " does not exist")
}

func TestSimpleFSLocalSrcFile(t *testing.T) {
	tc := libkb.SetupTest(t, "simplefs_path", 0)

	// make a temp local dest directory + files we will clean up later
	tempdir, err := ioutil.TempDir("", "simpleFStest")
	defer os.RemoveAll(tempdir)
	require.NoError(t, err)
	path1 := keybase1.NewPathWithLocal(filepath.Join(tempdir, "test1.txt"))
	err = ioutil.WriteFile(path1.Local(), []byte("foo"), 0644)
	require.NoError(t, err)

	isSrcDir, srcPathString, err := checkPathIsDir(context.TODO(), SimpleFSTestStat{localExists: true}, path1)
	require.NoError(tc.T, err, "bad path type")
	require.False(tc.T, isSrcDir)
	require.Equal(tc.T, path1.Local(), srcPathString)

	destPath := makeSimpleFSPath(tc.G, "/keybase/public/foobar")

	isDestDir, destPathString, err := checkPathIsDir(context.TODO(), SimpleFSTestStat{remoteExists: true}, destPath)
	require.NoError(tc.T, err, "bad path type")
	require.True(tc.T, isDestDir)
	require.Equal(tc.T, "/public/foobar", destPathString)

	destPath, err = makeDestPath(tc.G,
		context.TODO(),
		SimpleFSTestStat{},
		path1,
		destPath,
		true,
		"/public/foobar")
	assert.Equal(tc.T, "/public/foobar/test1.txt", destPath.Kbfs())
	require.NoError(tc.T, err, "bad path type")

	pathType, err := destPath.PathType()
	require.NoError(tc.T, err, "bad path type")
	assert.Equal(tc.T, keybase1.PathType_KBFS, pathType, "Expected remote path, got local")

	assert.Equal(tc.T, "/public/foobar/test1.txt", destPath.Kbfs())
}

func TestSimpleFSRemoteSrcFile(t *testing.T) {
	tc := libkb.SetupTest(t, "simplefs_path", 0)

	// make a temp local dest directory + files we will clean up later
	tempdir, err := ioutil.TempDir("", "simpleFstest")
	defer os.RemoveAll(tempdir)
	require.NoError(t, err)

	tempdir = filepath.ToSlash(tempdir)

	destPath := makeSimpleFSPath(tc.G, tempdir)
	srcPath := makeSimpleFSPath(tc.G, "/keybase/public/foobar/test1.txt")

	destPath, err = makeDestPath(tc.G,
		context.TODO(),
		SimpleFSTestStat{remoteExists: true},
		srcPath,
		destPath,
		true,
		tempdir)
	exists, err2 := libkb.FileExists(destPath.Local())
	tc.G.Log.Debug("makeDestPath fileExists %s: %v, %v", destPath.Local(), exists, err2)

	require.NoError(tc.T, err, "makeDestPath returns %s", pathToString(destPath))

	isSrcDir, srcPathString, err := checkPathIsDir(context.TODO(), SimpleFSTestStat{remoteExists: true}, srcPath)
	require.Equal(tc.T, "/public/foobar/test1.txt", srcPath.Kbfs())
	require.False(tc.T, isSrcDir)
	require.Equal(tc.T, "/public/foobar/test1.txt", srcPathString)
	require.Equal(tc.T, "test1.txt", filepath.Base(srcPathString))

	pathType, err := destPath.PathType()
	require.NoError(tc.T, err, "bad path type")
	assert.Equal(tc.T, keybase1.PathType_LOCAL, pathType, "Expected local path, got remote")

	assert.Equal(tc.T, filepath.ToSlash(filepath.Join(tempdir, "test1.txt")), destPath.Local())
}

func TestSimpleFSLocalSrcDir(t *testing.T) {
	tc := libkb.SetupTest(t, "simplefs_path", 0)

	// make a temp local dest directory + files we will clean up later
	tempdir, err := ioutil.TempDir("", "simpleFStest")
	defer os.RemoveAll(tempdir)
	require.NoError(t, err)
	path1 := keybase1.NewPathWithLocal(tempdir)
	require.NoError(t, err)
	testStatter := SimpleFSTestStat{localExists: true}

	isSrcDir, srcPathString, err := checkPathIsDir(context.TODO(), testStatter, path1)
	require.NoError(tc.T, err, "bad path type")
	require.True(tc.T, isSrcDir)
	require.Equal(tc.T, path1.Local(), srcPathString)

	destPathInitial := makeSimpleFSPath(tc.G, "/keybase/public/foobar")

	// Test when dest. exists.
	// We append the last element of the source in that case.
	testStatter.remoteExists = true
	isDestDir, destPathString, err := checkPathIsDir(context.TODO(), testStatter, destPathInitial)
	require.NoError(tc.T, err, "bad path type")
	require.True(tc.T, isDestDir)
	require.Equal(tc.T, "/public/foobar", destPathString)

	destPath, err := makeDestPath(tc.G,
		context.TODO(),
		testStatter,
		path1,
		destPathInitial,
		true,
		"/public/foobar")
	assert.Equal(tc.T, filepath.ToSlash(filepath.Join("/public/foobar", filepath.Base(tempdir))), destPath.Kbfs())
	assert.Equal(tc.T, err, TargetFileExistsError, "Expected that remote target path exists because of SimpleFSTestStat")
	//	require.NoError(tc.T, err, "bad path type")

	pathType, err := destPath.PathType()
	require.NoError(tc.T, err, "bad path type")
	assert.Equal(tc.T, keybase1.PathType_KBFS, pathType, "Expected remote path, got local")

	// Test when dest. does not exist.
	// Dest name should remain as-is in that case
	testStatter.localExists = false
	isDestDir, destPathString, err = checkPathIsDir(context.TODO(), testStatter, destPath)
	require.NoError(tc.T, err, "bad path type")
	require.True(tc.T, isDestDir)

	destPath, err = makeDestPath(tc.G,
		context.TODO(),
		SimpleFSTestStat{},
		path1,
		destPathInitial,
		true,
		"/public/foobar")
	assert.Equal(tc.T, "/public/foobar", destPath.Kbfs())
	require.NoError(tc.T, err, "bad path type")

	pathType, err = destPath.PathType()
	require.NoError(tc.T, err, "bad path type")
	assert.Equal(tc.T, keybase1.PathType_KBFS, pathType, "Expected remote path, got local")

}

func TestSimpleFSRemoteSrcDir(t *testing.T) {
	tc := libkb.SetupTest(t, "simplefs_path", 0)

	// make a temp local dest directory + files we will clean up later
	tempdir, err := ioutil.TempDir("", "simpleFStest")
	defer os.RemoveAll(tempdir)
	require.NoError(t, err)
	destPathInitial := keybase1.NewPathWithLocal(tempdir)
	require.NoError(t, err)
	testStatter := SimpleFSTestStat{remoteExists: true}

	srcPathInitial := makeSimpleFSPath(tc.G, "/keybase/public/foobar")

	isSrcDir, srcPathString, err := checkPathIsDir(context.TODO(), testStatter, srcPathInitial)
	require.NoError(tc.T, err, "bad path type")
	require.True(tc.T, isSrcDir)
	require.Equal(tc.T, srcPathInitial.Kbfs(), srcPathString)

	// Test when dest. exists.
	// We append the last element of the source in that case.
	testStatter.localExists = true
	isDestDir, destPathString, err := checkPathIsDir(context.TODO(), testStatter, destPathInitial)
	require.NoError(tc.T, err, "bad path type")
	require.True(tc.T, isDestDir)
	require.Equal(tc.T, tempdir, destPathString)

	destPath, err := makeDestPath(tc.G,
		context.TODO(),
		testStatter,
		srcPathInitial,
		destPathInitial,
		true,
		tempdir)
	assert.Equal(tc.T, filepath.ToSlash(filepath.Join(tempdir, "foobar")), destPath.Local())
	require.NoError(tc.T, err, "Expected that remote target path does not exist")

	pathType, err := destPath.PathType()
	require.NoError(tc.T, err, "bad path type")
	assert.Equal(tc.T, keybase1.PathType_LOCAL, pathType, "Expected local path, got remote")

	// Test when dest. does not exist by adding "foobar" on the end of the source.
	// Dest name should remain as-is in that case
	testStatter.localExists = false
	tempdir = filepath.Join(tempdir, "foobar")
	destPathInitial = keybase1.NewPathWithLocal(tempdir)
	isDestDir, destPathString, err = checkPathIsDir(context.TODO(), testStatter, destPathInitial)
	assert.Equal(tc.T, tempdir, destPathString, "should use dest dir as-is")

	destPath, err = makeDestPath(tc.G,
		context.TODO(),
		SimpleFSTestStat{},
		srcPathInitial,
		destPathInitial,
		true,
		tempdir)
	assert.Equal(tc.T, filepath.ToSlash(tempdir), destPath.Local())
	require.NoError(tc.T, err, "bad path type")

	pathType, err = destPath.PathType()
	require.NoError(tc.T, err, "bad path type")
	assert.Equal(tc.T, keybase1.PathType_LOCAL, pathType, "Expected remote path, got local")

}
