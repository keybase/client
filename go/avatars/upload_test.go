package avatars

import (
	"io"
	"io/ioutil"
	"mime"
	"mime/multipart"
	"os"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type uploadAvatarMockAPI struct {
	libkb.API
	Func func(map[string]string) error
}

func (a *uploadAvatarMockAPI) PostRaw(mctx libkb.MetaContext, arg libkb.APIArg, contentType string, r io.Reader) (*libkb.APIRes, error) {
	_, params, err := mime.ParseMediaType(contentType)
	if err != nil {
		return nil, err
	}

	postForm := make(map[string]string)

	mr := multipart.NewReader(r, params["boundary"])
	for {
		p, err := mr.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		slurp, err := ioutil.ReadAll(p)
		if err != nil {
			return nil, err
		}
		postForm[p.Header.Get("Content-Disposition")] = string(slurp)
	}

	err = a.Func(postForm)
	return nil, err
}

func TestUploadAvatar(t *testing.T) {
	tc := libkb.SetupTest(t, "TestUploadAvatar", 1)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("avtr", tc.G)
	require.NoError(t, err)

	// Prepare test avatar file
	tmpfile, err := ioutil.TempFile(os.TempDir(), "kbtest_avatar.png")
	require.NoError(t, err)
	tmpFileStr := "\x89PNGa somewhat goofy picture of a cat"
	_, err = tmpfile.WriteString(tmpFileStr)
	require.NoError(t, err)
	tmpfile.Close()
	t.Logf("Created a test avatar file: %s", tmpfile.Name())
	defer os.Remove(tmpfile.Name())

	mock := uploadAvatarMockAPI{}
	mock.Func = func(post map[string]string) error {
		require.Len(t, post, 5)
		require.Equal(t, "1", post["form-data; name=\"x0\""])
		require.Equal(t, "2", post["form-data; name=\"y0\""])
		require.Equal(t, "3", post["form-data; name=\"x1\""])
		require.Equal(t, "4", post["form-data; name=\"y1\""])
		require.Equal(t, tmpFileStr, post["form-data; name=\"avatar\"; filename=\"image\""])
		return nil
	}
	tc.G.API = &mock

	crop := keybase1.ImageCropRect{
		X0: 1, Y0: 2, X1: 3, Y1: 4,
	}

	mctx := libkb.NewMetaContextBackground(tc.G)
	UploadImage(mctx, tmpfile.Name(), nil, &crop)
}
