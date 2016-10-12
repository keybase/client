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

type UploadS3Result struct {
	S3Bucket string
	S3Path   string
	Size     int64
}

func UploadS3(log logger.Logger, r io.Reader, filename string, params chat1.S3AttachmentParams) (*UploadS3Result, error) {
	var body bytes.Buffer
	mpart := multipart.NewWriter(&body)

	// the order of these is important:
	if err := mpart.WriteField("key", params.ObjectKey); err != nil {
		return nil, err
	}
	if err := mpart.WriteField("acl", params.Acl); err != nil {
		return nil, err
	}
	if err := mpart.WriteField("X-Amz-Credential", params.Credential); err != nil {
		return nil, err
	}
	if err := mpart.WriteField("X-Amz-Algorithm", params.Algorithm); err != nil {
		return nil, err
	}
	if err := mpart.WriteField("X-Amz-Date", params.Date); err != nil {
		return nil, err
	}
	if err := mpart.WriteField("Policy", params.Policy); err != nil {
		return nil, err
	}
	if err := mpart.WriteField("X-Amz-Signature", params.Signature); err != nil {
		return nil, err
	}
	part, err := mpart.CreateFormFile("file", filepath.Base(filename))
	if err != nil {
		return nil, err
	}
	n, err := io.Copy(part, r)
	if err != nil {
		return nil, err
	}
	log.Debug("copied %d bytes to multipart", n)

	if err := mpart.Close(); err != nil {
		return nil, err
	}

	// XXX retry
	resp, err := http.Post(params.Endpoint, mpart.FormDataContentType(), &body)
	if err != nil {
		return nil, err
	}
	log.Debug("response: %+v", resp)
	bstr, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()
	log.Debug("response body:  %s", bstr)

	// XXX check response
	res := UploadS3Result{
		S3Bucket: params.Bucket,
		S3Path:   params.ObjectKey,
		Size:     n,
	}

	return &res, nil
}
