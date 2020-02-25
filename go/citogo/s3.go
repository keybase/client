package main

import (
	"bytes"
	"compress/gzip"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base32"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"strings"
	"time"
)

func gzipSource(src io.Reader) ([]byte, error) {
	buf := new(bytes.Buffer)
	gzipIn := gzip.NewWriter(buf)
	_, err := io.Copy(gzipIn, src)
	if err != nil {
		return nil, err
	}
	err = gzipIn.Close()
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func hashToHex(b []byte) string {
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}

func randString() (string, error) {
	c := 20
	b := make([]byte, c)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	return strings.ToLower(base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b)), nil
}

func awsStringSign4(key string, date string, region string, service string, toSign string) string {
	mac := func(key, payload []byte) []byte {
		f := hmac.New(sha256.New, key)
		_, _ = f.Write(payload)
		ret := f.Sum(nil)
		return ret
	}
	kSecret := []byte("AWS4" + key)
	kDate := mac(kSecret, []byte(date))
	kRegion := mac(kDate, []byte(region))
	kService := mac(kRegion, []byte(service))
	kSigning := mac(kService, []byte("aws4_request"))
	signedString := mac(kSigning, []byte(toSign))
	return hex.EncodeToString(signedString)

}

// s3 put without the dependencies, adopted from this shell script:
//
//  https://superuser.com/questions/279986/uploading-files-to-s3-account-from-linux-command-line
//
func s3put(src io.Reader, bucket string, name string) (string, error) {
	buf, err := gzipSource(src)
	if err != nil {
		return "", err
	}

	randSuffix, err := randString()
	if err != nil {
		return "", err
	}
	name += "-" + randSuffix + ".gz"

	payloadHash := hashToHex(buf)
	now := time.Now().UTC()
	dateLong := now.Format("20060102T150405Z")
	dateShort := now.Format("20060102")
	contentType := "application/gzip"
	host := bucket + ".s3.amazonaws.com"
	storageClass := "STANDARD"
	headerList := "content-type;host;x-amz-content-sha256;x-amz-date;x-amz-storage-class"
	canonicalRequest := strings.Join([]string{
		"PUT",
		"/" + name,
		"",
		"content-type:" + contentType,
		"host:" + host,
		"x-amz-content-sha256:" + payloadHash,
		"x-amz-date:" + dateLong,
		"x-amz-storage-class:" + storageClass,
		"",
		headerList,
		payloadHash,
	}, "\n")

	canonicalRequestHash := hashToHex([]byte(canonicalRequest))
	authType := "AWS4-HMAC-SHA256"
	region := "us-east-1"
	service := "s3"
	req2 := strings.Join([]string{dateShort, region, service, "aws4_request"}, "/")
	stringToSign := strings.Join([]string{
		authType,
		dateLong,
		req2,
		canonicalRequestHash,
	}, "\n")

	keyID := os.Getenv("CITOGO_AWS_ACCESS_KEY_ID")
	key := os.Getenv("CITOGO_AWS_SECRET_ACCESS_KEY")
	if keyID == "" || key == "" {
		return "", errors.New("need CITOGO_AWS_ACCESS_KEY_ID and CITOGO_AWS_SECRET_ACCESS_KEY environment variables")
	}
	sig := awsStringSign4(key, dateShort, region, service, stringToSign)
	authorization := authType + " " + strings.Join([]string{
		"Credential=" + strings.Join([]string{keyID, dateShort, region, service, "aws4_request"}, "/"),
		"SignedHeaders=" + headerList,
		"Signature=" + sig,
	}, ", ")

	client := &http.Client{}
	url := "https://" + host + "/" + name
	req, err := http.NewRequest("PUT", url, bytes.NewReader(buf))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-type", contentType)
	req.Header.Set("Host", host)
	req.Header.Set("X-Amz-Content-SHA256", payloadHash)
	req.Header.Set("X-Amz-Date", dateLong)
	req.Header.Set("X-Amz-Storage-Class", storageClass)
	req.Header.Set("Authorization", authorization)

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	_, err = ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	where := fmt.Sprintf("(fetch with: ```curl -s -o - https://%s.s3.amazonaws.com/%s | zcat -d```)", bucket, name)

	return where, nil
}
