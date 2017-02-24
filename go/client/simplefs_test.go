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

func TestSimpleFSPathRemote(t *testing.T) {
	tc := libkb.SetupTest(t, "simplefs_path", 0)

	testPath := makeSimpleFSPath(tc.G, "/keybase/private/foobar")
	pathType, err := testPath.PathType()
	require.NoError(tc.T, err, "bad path type")
	assert.Equal(tc.T, keybase1.PathType_KBFS, pathType, "Expected remote path, got local")
	assert.Equal(tc.T, "/private/foobar", testPath.Kbfs())
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

func TestSimpleFSMultiPathLocal(t *testing.T) {
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

func TestSimpleFSMultiPathRemote(t *testing.T) {
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
