package chat

import (
	"bytes"
	"io"
	"io/ioutil"
	"mime/multipart"
	"net/http"
	"path/filepath"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
)

func UploadS3(log logger.Logger, r io.Reader, filename string, params chat1.S3AttachmentParams) error {
	var body bytes.Buffer
	mpart := multipart.NewWriter(&body)

	// the order of these is important:
	if err := mpart.WriteField("key", params.ObjectKey); err != nil {
		return err
	}
	if err := mpart.WriteField("acl", params.Acl); err != nil {
		return err
	}
	if err := mpart.WriteField("X-Amz-Credential", params.Credential); err != nil {
		return err
	}
	if err := mpart.WriteField("X-Amz-Algorithm", params.Algorithm); err != nil {
		return err
	}
	if err := mpart.WriteField("X-Amz-Date", params.Date); err != nil {
		return err
	}
	if err := mpart.WriteField("Policy", params.Policy); err != nil {
		return err
	}
	if err := mpart.WriteField("X-Amz-Signature", params.Signature); err != nil {
		return err
	}
	part, err := mpart.CreateFormFile("file", filepath.Base(filename))
	if err != nil {
		return err
	}
	n, err := io.Copy(part, r)
	if err != nil {
		return err
	}
	log.Debug("copied %d bytes to multipart", n)

	if err := mpart.Close(); err != nil {
		return err
	}

	resp, err := http.Post(params.Endpoint, mpart.FormDataContentType(), &body)
	if err != nil {
		return err
	}
	log.Debug("response: %+v", resp)
	bstr, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	resp.Body.Close()
	log.Debug("response body:  %s", bstr)

	return nil
}
