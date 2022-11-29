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
	keySecret := []byte("AWS4" + key)
	keyDate := mac(keySecret, []byte(date))
	keyRegion := mac(keyDate, []byte(region))
	keyService := mac(keyRegion, []byte(service))
	keySigning := mac(keyService, []byte("aws4_request"))
	signedString := mac(keySigning, []byte(toSign))
	return hex.EncodeToString(signedString)

}

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

	_, err = awsCall("s3", bucket+".s3.amazonaws.com", name, "PUT", buf)
	if err != nil {
		return "", err
	}
	where := fmt.Sprintf("(fetch with: ```curl -s -o - https://%s.s3.amazonaws.com/%s | zcat -d | less```)", bucket, name)
	return where, nil
}

func lambdaInvoke(functionName string, buf []byte) error {
	_, err := awsCall("lambda", "lambda.us-east-1.amazonaws.com", "2015-03-31/functions/"+functionName+"/invocations", "POST", buf)
	return err
}

// generic aws call without the dependencies, adopted from this shell script:
//
//	https://superuser.com/questions/279986/uploading-files-to-s3-account-from-linux-command-line
func awsCall(service string, host string, path string, method string, buf []byte) (response []byte, err error) {
	payloadHash := hashToHex(buf)
	now := time.Now().UTC()
	dateLong := now.Format("20060102T150405Z")
	dateShort := now.Format("20060102")
	contentType := "application/gzip"
	storageClass := "STANDARD"
	headerList := "content-type;host;x-amz-content-sha256;x-amz-date;x-amz-storage-class"
	canonicalRequest := strings.Join([]string{
		method,
		"/" + path,
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
		return response, errors.New("need CITOGO_AWS_ACCESS_KEY_ID and CITOGO_AWS_SECRET_ACCESS_KEY environment variables")
	}
	sig := awsStringSign4(key, dateShort, region, service, stringToSign)
	authorization := authType + " " + strings.Join([]string{
		"Credential=" + strings.Join([]string{keyID, dateShort, region, service, "aws4_request"}, "/"),
		"SignedHeaders=" + headerList,
		"Signature=" + sig,
	}, ", ")

	client := &http.Client{}
	url := "https://" + host + "/" + path
	req, err := http.NewRequest(method, url, bytes.NewReader(buf))
	if err != nil {
		return response, err
	}
	req.Header.Set("Content-type", contentType)
	req.Header.Set("Host", host)
	req.Header.Set("X-Amz-Content-SHA256", payloadHash)
	req.Header.Set("X-Amz-Date", dateLong)
	req.Header.Set("X-Amz-Storage-Class", storageClass)
	req.Header.Set("Authorization", authorization)

	resp, err := client.Do(req)
	if err != nil {
		return response, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return response, err
	}
	return body, nil
}
