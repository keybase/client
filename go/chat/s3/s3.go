//
// goamz - Go packages to interact with the Amazon Web Services.
//
//   https://wiki.ubuntu.com/goamz
//
// Copyright (c) 2011 Canonical Ltd.
//
// Written by Gustavo Niemeyer <gustavo.niemeyer@canonical.com>
//
// Modified by Keybase to allow external signing of requests.

package s3

import (
	"bytes"
	"crypto/md5"
	"encoding/base64"
	"encoding/xml"
	"fmt"
	"github.com/keybase/client/go/libkb"
	"io"
	"io/ioutil"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"
	"time"

	"golang.org/x/net/context"
)

const debug = false

type Signer interface {
	Sign(payload []byte) ([]byte, error)
}

// The S3 type encapsulates operations with an S3 region.
type S3 struct {
	Region
	libkb.Contextified

	// This is needed for payload construction.  It's
	// ok for clients to know it.
	AccessKey string

	// Signer signs payloads for s3 request authorization.
	Signer Signer

	// ConnectTimeout is the maximum time a request attempt will
	// wait for a successful connection to be made.
	//
	// A value of zero means no timeout.
	ConnectTimeout time.Duration

	// ReadTimeout is the maximum time a request attempt will wait
	// for an individual read to complete.
	//
	// A value of zero means no timeout.
	ReadTimeout time.Duration

	// WriteTimeout is the maximum time a request attempt will
	// wait for an individual write to complete.
	//
	// A value of zero means no timeout.
	WriteTimeout time.Duration

	// RequestTimeout is the maximum time a request attempt can
	// take before operations return a timeout error.
	//
	// This includes connection time, any redirects, and reading
	// the response body. The timer remains running after the request
	// is made so it can interrupt reading of the response data.
	//
	// A Timeout of zero means no timeout.
	RequestTimeout time.Duration

	// AttemptStrategy is the attempt strategy used for requests.
	AttemptStrategy

	// client used for requests
	client *http.Client
}

// The Bucket type encapsulates operations with an S3 bucket.
type Bucket struct {
	*S3
	Name string
}

// The Owner type represents the owner of the object in an S3 bucket.
type Owner struct {
	ID          string
	DisplayName string
}

// Fold options into an Options struct
//
type Options struct {
	SSE              bool
	Meta             map[string][]string
	ContentEncoding  string
	CacheControl     string
	RedirectLocation string
	ContentMD5       string
	// What else?
	// Content-Disposition string
	//// The following become headers so they are []strings rather than strings... I think
	// x-amz-storage-class []string
}

type CopyOptions struct {
	Options
	MetadataDirective string
	ContentType       string
}

// CopyObjectResult is the output from a Copy request
type CopyObjectResult struct {
	ETag         string
	LastModified string
}

// DefaultAttemptStrategy is the default AttemptStrategy used by S3 objects created by New.
var DefaultAttemptStrategy = AttemptStrategy{
	Min:   5,
	Total: 5 * time.Second,
	Delay: 200 * time.Millisecond,
}

// New creates a new S3.  Optional client argument allows for custom http.clients to be used.
func New(g *libkb.GlobalContext, signer Signer, region Region, client ...*http.Client) *S3 {

	var httpclient *http.Client

	if len(client) > 0 {
		httpclient = client[0]
	}

	return &S3{
		Signer:          signer,
		Region:          region,
		AttemptStrategy: DefaultAttemptStrategy,
		client:          httpclient,
		Contextified:    libkb.NewContextified(g),
	}
}

func (s3 *S3) SetAccessKey(key string) {
	s3.AccessKey = key
}

// Bucket returns a Bucket with the given name.
func (s3 *S3) Bucket(name string) BucketInt {
	if s3.Region.S3BucketEndpoint != "" || s3.Region.S3LowercaseBucket {
		name = strings.ToLower(name)
	}
	return &Bucket{s3, name}
}

var createBucketConfiguration = `<CreateBucketConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <LocationConstraint>%s</LocationConstraint>
</CreateBucketConfiguration>`

// locationConstraint returns an io.Reader specifying a LocationConstraint if
// required for the region.
//
// See http://goo.gl/bh9Kq for details.
func (s3 *S3) locationConstraint() io.Reader {
	constraint := ""
	if s3.Region.S3LocationConstraint {
		constraint = fmt.Sprintf(createBucketConfiguration, s3.Region.Name)
	}
	return strings.NewReader(constraint)
}

type ACL string

const (
	Private           = ACL("private")
	PublicRead        = ACL("public-read")
	PublicReadWrite   = ACL("public-read-write")
	AuthenticatedRead = ACL("authenticated-read")
	BucketOwnerRead   = ACL("bucket-owner-read")
	BucketOwnerFull   = ACL("bucket-owner-full-control")
)

// PutBucket creates a new bucket.
//
// See http://goo.gl/ndjnR for details.
func (b *Bucket) PutBucket(ctx context.Context, perm ACL) error {
	headers := map[string][]string{
		"x-amz-acl": {string(perm)},
	}
	req := &request{
		method:  "PUT",
		bucket:  b.Name,
		path:    "/",
		headers: headers,
		payload: b.locationConstraint(),
	}
	return b.S3.query(ctx, req, nil)
}

// DelBucket removes an existing S3 bucket. All objects in the bucket must
// be removed before the bucket itself can be removed.
//
// See http://goo.gl/GoBrY for details.
func (b *Bucket) DelBucket() (err error) {
	req := &request{
		method: "DELETE",
		bucket: b.Name,
		path:   "/",
	}
	for attempt := b.S3.AttemptStrategy.Start(); attempt.Next(); {
		err = b.S3.query(context.Background(), req, nil)
		if !shouldRetry(err) {
			break
		}
	}
	return err
}

// Get retrieves an object from an S3 bucket.
//
// See http://goo.gl/isCO7 for details.
func (b *Bucket) Get(ctx context.Context, path string) (data []byte, err error) {
	body, err := b.GetReader(ctx, path)
	defer func() {
		if body != nil {
			body.Close()
		}
	}()
	if err != nil {
		return nil, err
	}
	data, err = ioutil.ReadAll(body)
	return data, err
}

// GetReader retrieves an object from an S3 bucket,
// returning the body of the HTTP response.
// It is the caller's responsibility to call Close on rc when
// finished reading.
func (b *Bucket) GetReader(ctx context.Context, path string) (rc io.ReadCloser, err error) {
	resp, err := b.GetResponse(ctx, path)
	if resp != nil {
		return resp.Body, err
	}
	return nil, err
}

// GetReaderWithRange retrieves an object from an S3 bucket using the specified range,
// returning the body of the HTTP response.
// It is the caller's responsibility to call Close on rc when
// finished reading.
func (b *Bucket) GetReaderWithRange(ctx context.Context, path string, begin, end int64) (rc io.ReadCloser, err error) {
	header := make(http.Header)
	header.Add("Range", fmt.Sprintf("bytes=%d-%d", begin, end-1))
	resp, err := b.GetResponseWithHeaders(ctx, path, header)
	if resp != nil {
		return resp.Body, err
	}
	return nil, err
}

// GetResponse retrieves an object from an S3 bucket,
// returning the HTTP response.
// It is the caller's responsibility to call Close on rc when
// finished reading
func (b *Bucket) GetResponse(ctx context.Context, path string) (resp *http.Response, err error) {
	return b.GetResponseWithHeaders(ctx, path, make(http.Header))
}

// GetReaderWithHeaders retrieves an object from an S3 bucket
// Accepts custom headers to be sent as the second parameter
// returning the body of the HTTP response.
// It is the caller's responsibility to call Close on rc when
// finished reading
func (b *Bucket) GetResponseWithHeaders(ctx context.Context, path string, headers map[string][]string) (resp *http.Response, err error) {
	req := &request{
		bucket:  b.Name,
		path:    path,
		headers: headers,
	}
	err = b.S3.prepare(req)
	if err != nil {
		return nil, err
	}
	for attempt := b.S3.AttemptStrategy.Start(); attempt.Next(); {
		resp, err := b.S3.run(ctx, req, nil)
		if shouldRetry(err) && attempt.HasNext() {
			continue
		}
		if err != nil {
			return nil, err
		}
		return resp, nil
	}
	panic("unreachable")
}

// Exists checks whether or not an object exists on an S3 bucket using a HEAD request.
func (b *Bucket) Exists(path string) (exists bool, err error) {
	req := &request{
		method: "HEAD",
		bucket: b.Name,
		path:   path,
	}
	err = b.S3.prepare(req)
	if err != nil {
		return
	}
	for attempt := b.S3.AttemptStrategy.Start(); attempt.Next(); {
		resp, err := b.S3.run(context.Background(), req, nil)

		if shouldRetry(err) && attempt.HasNext() {
			continue
		}

		if err != nil {
			// We can treat a 403 or 404 as non existence
			if e, ok := err.(*Error); ok && (e.StatusCode == 403 || e.StatusCode == 404) {
				return false, nil
			}
			return false, err
		}

		if resp.StatusCode/100 == 2 {
			exists = true
		}
		return exists, err
	}
	return false, fmt.Errorf("S3 Currently Unreachable")
}

// Head HEADs an object in the S3 bucket, returns the response with
// no body see http://bit.ly/17K1ylI
func (b *Bucket) Head(path string, headers map[string][]string) (*http.Response, error) {
	req := &request{
		method:  "HEAD",
		bucket:  b.Name,
		path:    path,
		headers: headers,
	}
	err := b.S3.prepare(req)
	if err != nil {
		return nil, err
	}

	for attempt := b.S3.AttemptStrategy.Start(); attempt.Next(); {
		resp, err := b.S3.run(context.Background(), req, nil)
		if shouldRetry(err) && attempt.HasNext() {
			continue
		}
		if err != nil {
			return nil, err
		}
		return resp, err
	}
	return nil, fmt.Errorf("S3 Currently Unreachable")
}

// Put inserts an object into the S3 bucket.
//
// See http://goo.gl/FEBPD for details.
func (b *Bucket) Put(ctx context.Context, path string, data []byte, contType string, perm ACL, options Options) error {
	body := bytes.NewBuffer(data)
	return b.PutReader(ctx, path, body, int64(len(data)), contType, perm, options)
}

// PutCopy puts a copy of an object given by the key path into bucket b using b.Path as the target key
func (b *Bucket) PutCopy(path string, perm ACL, options CopyOptions, source string) (result *CopyObjectResult, err error) {
	headers := map[string][]string{
		"x-amz-acl":         {string(perm)},
		"x-amz-copy-source": {source},
	}
	options.addHeaders(headers)
	req := &request{
		method:  "PUT",
		bucket:  b.Name,
		path:    path,
		headers: headers,
	}
	result = &CopyObjectResult{}
	for attempt := b.S3.AttemptStrategy.Start(); attempt.Next(); {
		err = b.S3.query(context.Background(), req, result)
		if !shouldRetry(err) {
			break
		}
	}
	if err != nil {
		return nil, err
	}
	return result, nil
}

/*
PutHeader - like Put, inserts an object into the S3 bucket.
Instead of Content-Type string, pass in custom headers to override defaults.
*/
func (b *Bucket) PutHeader(ctx context.Context, path string, data []byte, customHeaders map[string][]string, perm ACL) error {
	body := bytes.NewBuffer(data)
	return b.PutReaderHeader(ctx, path, body, int64(len(data)), customHeaders, perm)
}

// PutReader inserts an object into the S3 bucket by consuming data
// from r until EOF.
func (b *Bucket) PutReader(ctx context.Context, path string, r io.Reader, length int64, contType string, perm ACL, options Options) error {
	headers := map[string][]string{
		"Content-Length": {strconv.FormatInt(length, 10)},
		"Content-Type":   {contType},
		"x-amz-acl":      {string(perm)},
	}
	options.addHeaders(headers)
	req := &request{
		method:  "PUT",
		bucket:  b.Name,
		path:    path,
		headers: headers,
		payload: r,
	}
	return b.S3.query(ctx, req, nil)
}

/*
PutReaderHeader - like PutReader, inserts an object into S3 from a reader.
Instead of Content-Type string, pass in custom headers to override defaults.
*/
func (b *Bucket) PutReaderHeader(ctx context.Context, path string, r io.Reader, length int64, customHeaders map[string][]string, perm ACL) error {
	// Default headers
	headers := map[string][]string{
		"Content-Length": {strconv.FormatInt(length, 10)},
		"Content-Type":   {"application/text"},
		"x-amz-acl":      {string(perm)},
	}

	// Override with custom headers
	for key, value := range customHeaders {
		headers[key] = value
	}

	req := &request{
		method:  "PUT",
		bucket:  b.Name,
		path:    path,
		headers: headers,
		payload: r,
	}
	return b.S3.query(ctx, req, nil)
}

// addHeaders adds o's specified fields to headers
func (o Options) addHeaders(headers map[string][]string) {
	if o.SSE {
		headers["x-amz-server-side-encryption"] = []string{"AES256"}
	}
	if len(o.ContentEncoding) != 0 {
		headers["Content-Encoding"] = []string{o.ContentEncoding}
	}
	if len(o.CacheControl) != 0 {
		headers["Cache-Control"] = []string{o.CacheControl}
	}
	if len(o.ContentMD5) != 0 {
		headers["Content-MD5"] = []string{o.ContentMD5}
	}
	if len(o.RedirectLocation) != 0 {
		headers["x-amz-website-redirect-location"] = []string{o.RedirectLocation}
	}
	for k, v := range o.Meta {
		headers["x-amz-meta-"+k] = v
	}
}

// addHeaders adds o's specified fields to headers
func (o CopyOptions) addHeaders(headers map[string][]string) {
	o.Options.addHeaders(headers)
	if len(o.MetadataDirective) != 0 {
		headers["x-amz-metadata-directive"] = []string{o.MetadataDirective}
	}
	if len(o.ContentType) != 0 {
		headers["Content-Type"] = []string{o.ContentType}
	}
}

func makeXMLBuffer(doc []byte) *bytes.Buffer {
	buf := new(bytes.Buffer)
	buf.WriteString(xml.Header)
	buf.Write(doc)
	return buf
}

type RoutingRule struct {
	ConditionKeyPrefixEquals     string `xml:"Condition>KeyPrefixEquals"`
	RedirectReplaceKeyPrefixWith string `xml:"Redirect>ReplaceKeyPrefixWith,omitempty"`
	RedirectReplaceKeyWith       string `xml:"Redirect>ReplaceKeyWith,omitempty"`
}

type WebsiteConfiguration struct {
	XMLName             xml.Name       `xml:"http://s3.amazonaws.com/doc/2006-03-01/ WebsiteConfiguration"`
	IndexDocumentSuffix string         `xml:"IndexDocument>Suffix"`
	ErrorDocumentKey    string         `xml:"ErrorDocument>Key"`
	RoutingRules        *[]RoutingRule `xml:"RoutingRules>RoutingRule,omitempty"`
}

func (b *Bucket) PutBucketWebsite(configuration WebsiteConfiguration) error {

	doc, err := xml.Marshal(configuration)
	if err != nil {
		return err
	}

	buf := makeXMLBuffer(doc)

	return b.PutBucketSubresource("website", buf, int64(buf.Len()))
}

func (b *Bucket) PutBucketSubresource(subresource string, r io.Reader, length int64) error {
	headers := map[string][]string{
		"Content-Length": {strconv.FormatInt(length, 10)},
	}
	req := &request{
		path:    "/",
		method:  "PUT",
		bucket:  b.Name,
		headers: headers,
		payload: r,
		params:  url.Values{subresource: {""}},
	}

	return b.S3.query(context.Background(), req, nil)
}

// Del removes an object from the S3 bucket.
//
// See http://goo.gl/APeTt for details.
func (b *Bucket) Del(ctx context.Context, path string) error {
	req := &request{
		method: "DELETE",
		bucket: b.Name,
		path:   path,
	}
	return b.S3.query(ctx, req, nil)
}

type Delete struct {
	Quiet   bool     `xml:"Quiet,omitempty"`
	Objects []Object `xml:"Object"`
}

type Object struct {
	Key       string `xml:"Key"`
	VersionID string `xml:"VersionId,omitempty"`
}

// DelMulti removes up to 1000 objects from the S3 bucket.
//
// See http://goo.gl/jx6cWK for details.
func (b *Bucket) DelMulti(objects Delete) error {
	doc, err := xml.Marshal(objects)
	if err != nil {
		return err
	}

	buf := makeXMLBuffer(doc)
	digest := md5.New()
	size, err := digest.Write(buf.Bytes())
	if err != nil {
		return err
	}

	headers := map[string][]string{
		"Content-Length": {strconv.FormatInt(int64(size), 10)},
		"Content-MD5":    {base64.StdEncoding.EncodeToString(digest.Sum(nil))},
		"Content-Type":   {"text/xml"},
	}
	req := &request{
		path:    "/",
		method:  "POST",
		params:  url.Values{"delete": {""}},
		bucket:  b.Name,
		headers: headers,
		payload: buf,
	}

	return b.S3.query(context.Background(), req, nil)
}

// The ListResp type holds the results of a List bucket operation.
type ListResp struct {
	Name       string
	Prefix     string
	Delimiter  string
	Marker     string
	NextMarker string
	MaxKeys    int

	// IsTruncated is true if the results have been truncated because
	// there are more keys and prefixes than can fit in MaxKeys.
	// N.B. this is the opposite sense to that documented (incorrectly) in
	// http://goo.gl/YjQTc
	IsTruncated    bool
	Contents       []Key
	CommonPrefixes []string `xml:">Prefix"`
}

// The Key type represents an item stored in an S3 bucket.
type Key struct {
	Key          string
	LastModified string
	Size         int64
	// ETag gives the hex-encoded MD5 sum of the contents,
	// surrounded with double-quotes.
	ETag         string
	StorageClass string
	Owner        Owner
}

// List returns information about objects in an S3 bucket.
//
// The prefix parameter limits the response to keys that begin with the
// specified prefix.
//
// The delim parameter causes the response to group all of the keys that
// share a common prefix up to the next delimiter in a single entry within
// the CommonPrefixes field. You can use delimiters to separate a bucket
// into different groupings of keys, similar to how folders would work.
//
// The marker parameter specifies the key to start with when listing objects
// in a bucket. Amazon S3 lists objects in alphabetical order and
// will return keys alphabetically greater than the marker.
//
// The max parameter specifies how many keys + common prefixes to return in
// the response. The default is 1000.
//
// For example, given these keys in a bucket:
//
//     index.html
//     index2.html
//     photos/2006/January/sample.jpg
//     photos/2006/February/sample2.jpg
//     photos/2006/February/sample3.jpg
//     photos/2006/February/sample4.jpg
//
// Listing this bucket with delimiter set to "/" would yield the
// following result:
//
//     &ListResp{
//         Name:      "sample-bucket",
//         MaxKeys:   1000,
//         Delimiter: "/",
//         Contents:  []Key{
//             {Key: "index.html", "index2.html"},
//         },
//         CommonPrefixes: []string{
//             "photos/",
//         },
//     }
//
// Listing the same bucket with delimiter set to "/" and prefix set to
// "photos/2006/" would yield the following result:
//
//     &ListResp{
//         Name:      "sample-bucket",
//         MaxKeys:   1000,
//         Delimiter: "/",
//         Prefix:    "photos/2006/",
//         CommonPrefixes: []string{
//             "photos/2006/February/",
//             "photos/2006/January/",
//         },
//     }
//
// See http://goo.gl/YjQTc for details.
func (b *Bucket) List(prefix, delim, marker string, max int) (result *ListResp, err error) {
	params := map[string][]string{
		"prefix":    {prefix},
		"delimiter": {delim},
		"marker":    {marker},
	}
	if max != 0 {
		params["max-keys"] = []string{strconv.FormatInt(int64(max), 10)}
	}
	req := &request{
		bucket: b.Name,
		params: params,
	}
	result = &ListResp{}
	for attempt := b.S3.AttemptStrategy.Start(); attempt.Next(); {
		err = b.S3.query(context.Background(), req, result)
		if !shouldRetry(err) {
			break
		}
	}
	if err != nil {
		return nil, err
	}
	return result, nil
}

// The VersionsResp type holds the results of a list bucket Versions operation.
type VersionsResp struct {
	Name            string
	Prefix          string
	KeyMarker       string
	VersionIDMarker string `xml:"VersionIdMarker"`
	MaxKeys         int
	Delimiter       string
	IsTruncated     bool
	Versions        []Version
	CommonPrefixes  []string `xml:">Prefix"`
}

// The Version type represents an object version stored in an S3 bucket.
type Version struct {
	Key          string
	VersionID    string `xml:"VersionId"`
	IsLatest     bool
	LastModified string
	// ETag gives the hex-encoded MD5 sum of the contents,
	// surrounded with double-quotes.
	ETag         string
	Size         int64
	Owner        Owner
	StorageClass string
}

func (b *Bucket) Versions(prefix, delim, keyMarker string, versionIDMarker string, max int) (result *VersionsResp, err error) {
	params := map[string][]string{
		"versions":  {""},
		"prefix":    {prefix},
		"delimiter": {delim},
	}

	if len(versionIDMarker) != 0 {
		params["version-id-marker"] = []string{versionIDMarker}
	}
	if len(keyMarker) != 0 {
		params["key-marker"] = []string{keyMarker}
	}

	if max != 0 {
		params["max-keys"] = []string{strconv.FormatInt(int64(max), 10)}
	}
	req := &request{
		bucket: b.Name,
		params: params,
	}
	result = &VersionsResp{}
	for attempt := b.S3.AttemptStrategy.Start(); attempt.Next(); {
		err = b.S3.query(context.Background(), req, result)
		if !shouldRetry(err) {
			break
		}
	}
	if err != nil {
		return nil, err
	}
	return result, nil
}

// Returns a mapping of all key names in this bucket to Key objects
func (b *Bucket) GetBucketContents() (*map[string]Key, error) {
	bucketContents := map[string]Key{}
	prefix := ""
	pathSeparator := ""
	marker := ""
	for {
		contents, err := b.List(prefix, pathSeparator, marker, 1000)
		if err != nil {
			return &bucketContents, err
		}
		for _, key := range contents.Contents {
			bucketContents[key.Key] = key
		}
		if contents.IsTruncated {
			marker = contents.NextMarker
		} else {
			break
		}
	}

	return &bucketContents, nil
}

// URL returns a non-signed URL that allows retrieving the
// object at path. It only works if the object is publicly
// readable (see SignedURL).
func (b *Bucket) URL(path string) string {
	req := &request{
		bucket: b.Name,
		path:   path,
	}
	err := b.S3.prepare(req)
	if err != nil {
		panic(err)
	}
	u, err := req.url()
	if err != nil {
		panic(err)
	}
	u.RawQuery = ""
	return u.String()
}

// SignedURL returns a signed URL that allows anyone holding the URL
// to retrieve the object at path. The signature is valid until expires.
func (b *Bucket) SignedURL(path string, expires time.Time) string {
	req := &request{
		bucket: b.Name,
		path:   path,
		params: url.Values{"Expires": {strconv.FormatInt(expires.Unix(), 10)}},
	}
	err := b.S3.prepare(req)
	if err != nil {
		panic(err)
	}
	u, err := req.url()
	if err != nil {
		panic(err)
	}
	return u.String()
}

type request struct {
	method   string
	bucket   string
	path     string
	params   url.Values
	headers  http.Header
	baseurl  string
	payload  io.Reader
	prepared bool
}

func (req *request) url() (*url.URL, error) {
	u, err := url.Parse(req.baseurl)
	if err != nil {
		return nil, fmt.Errorf("bad S3 endpoint URL %q: %v", req.baseurl, err)
	}
	u.RawQuery = req.params.Encode()
	u.Path = req.path
	return u, nil
}

// query prepares and runs the req request.
// If resp is not nil, the XML data contained in the response
// body will be unmarshalled on it.
func (s3 *S3) query(ctx context.Context, req *request, resp interface{}) error {
	err := s3.prepare(req)
	if err == nil {
		var httpResponse *http.Response
		httpResponse, err = s3.run(ctx, req, resp)
		if resp == nil && httpResponse != nil {
			httpResponse.Body.Close()
		}
	}
	return err
}

// prepare sets up req to be delivered to S3.
func (s3 *S3) prepare(req *request) error {
	var signpath = req.path

	if !req.prepared {
		req.prepared = true
		if req.method == "" {
			req.method = "GET"
		}
		// Copy so they can be mutated without affecting on retries.
		params := make(url.Values)
		headers := make(http.Header)
		for k, v := range req.params {
			params[k] = v
		}
		for k, v := range req.headers {
			headers[k] = v
		}
		req.params = params
		req.headers = headers
		if !strings.HasPrefix(req.path, "/") {
			req.path = "/" + req.path
		}
		signpath = req.path
		if req.bucket != "" {
			req.baseurl = s3.Region.S3BucketEndpoint
			if req.baseurl == "" {
				// Use the path method to address the bucket.
				req.baseurl = s3.Region.S3Endpoint
				req.path = "/" + req.bucket + req.path
			} else {
				// Just in case, prevent injection.
				if strings.ContainsAny(req.bucket, "/:@") {
					return fmt.Errorf("bad S3 bucket: %q", req.bucket)
				}
				req.baseurl = strings.Replace(req.baseurl, "${bucket}", req.bucket, -1)
			}
			signpath = "/" + req.bucket + signpath
		}
	}

	// Always sign again as it's not clear how far the
	// server has handled a previous attempt.
	u, err := url.Parse(req.baseurl)
	if err != nil {
		return fmt.Errorf("bad S3 endpoint URL %q: %v", req.baseurl, err)
	}
	reqSignpathSpaceFix := (&url.URL{Path: signpath}).String()
	req.headers["Host"] = []string{u.Host}
	req.headers["Date"] = []string{time.Now().In(time.UTC).Format(time.RFC1123)}
	return s3.sign(req.method, reqSignpathSpaceFix, req.params, req.headers)
}

// run sends req and returns the http response from the server.
// If resp is not nil, the XML data contained in the response
// body will be unmarshalled on it.
func (s3 *S3) run(ctx context.Context, req *request, resp interface{}) (*http.Response, error) {
	if debug {
		log.Printf("Running S3 request: %#v", req)
	}

	u, err := req.url()
	if err != nil {
		return nil, err
	}

	hreq := &http.Request{
		URL:        u,
		Method:     req.method,
		ProtoMajor: 1,
		ProtoMinor: 1,
		Close:      true,
		Header:     req.headers,
	}

	if ctx != nil {
		hreq = hreq.WithContext(ctx)
	}

	if v, ok := req.headers["Content-Length"]; ok {
		hreq.ContentLength, _ = strconv.ParseInt(v[0], 10, 64)
		delete(req.headers, "Content-Length")
	}
	if req.payload != nil {
		hreq.Body = ioutil.NopCloser(req.payload)
	}

	if s3.client == nil {
		s3.client = &http.Client{
			Transport: &http.Transport{
				Dial: func(netw, addr string) (c net.Conn, err error) {
					c, err = net.DialTimeout(netw, addr, s3.ConnectTimeout)
					if err != nil {
						return
					}

					var deadline time.Time
					if s3.RequestTimeout > 0 {
						deadline = time.Now().Add(s3.RequestTimeout)
						err := c.SetDeadline(deadline)
						if err != nil {
							return nil, err
						}
					}

					if s3.ReadTimeout > 0 || s3.WriteTimeout > 0 {
						c = &ioTimeoutConn{
							TCPConn:         c.(*net.TCPConn),
							readTimeout:     s3.ReadTimeout,
							writeTimeout:    s3.WriteTimeout,
							requestDeadline: deadline,
						}
					}
					return
				},
				Proxy: libkb.MakeProxy(s3.G().Env),
			},
		}
	}

	hresp, err := s3.client.Do(hreq)
	if err != nil {
		return nil, err
	}
	if debug {
		dump, _ := httputil.DumpResponse(hresp, true)
		log.Printf("} -> %s\n", dump)
	}
	if hresp.StatusCode != 200 && hresp.StatusCode != 204 && hresp.StatusCode != 206 {
		defer hresp.Body.Close()
		return nil, buildError(hresp)
	}
	if resp != nil {
		err = xml.NewDecoder(hresp.Body).Decode(resp)
		hresp.Body.Close()
		if debug {
			log.Printf("goamz.s3> decoded xml into %#v", resp)
		}
	}
	return hresp, err
}

// Error represents an error in an operation with S3.
type Error struct {
	StatusCode int    // HTTP status code (200, 403, ...)
	Code       string // EC2 error code ("UnsupportedOperation", ...)
	Message    string // The human-oriented error message
	BucketName string
	RequestID  string `xml:"RequestId"`
	HostID     string `xml:"HostId"`
}

func (e *Error) Error() string {
	return e.Message
}

func buildError(r *http.Response) error {
	if debug {
		log.Printf("got error (status code %v)", r.StatusCode)
		data, err := ioutil.ReadAll(r.Body)
		if err != nil {
			log.Printf("\tread error: %v", err)
		} else {
			log.Printf("\tdata:\n%s\n\n", data)
		}
		r.Body = ioutil.NopCloser(bytes.NewBuffer(data))
	}

	err := Error{}

	// TODO return error if Unmarshal fails?
	decodeErr := xml.NewDecoder(r.Body).Decode(&err)
	if decodeErr != nil {
		log.Printf("\tdecodeErr error: %v", decodeErr)
	}
	r.Body.Close()
	err.StatusCode = r.StatusCode
	if err.Message == "" {
		err.Message = r.Status
	}
	if debug {
		log.Printf("err: %#v\n", err)
	}
	return &err
}

func shouldRetry(err error) bool {
	if err == nil {
		return false
	}
	if e, ok := err.(*url.Error); ok {
		// Transport returns this string if it detects a write on a connection which
		// has already had an error
		if e.Err.Error() == "http: can't write HTTP request on broken connection" {
			return true
		}
		err = e.Err
	}

	switch err {
	case io.ErrUnexpectedEOF, io.EOF:
		return true
	}
	switch e := err.(type) {
	case *net.DNSError:
		return true
	case *net.OpError:
		switch e.Op {
		case "read", "write", "WSARecv", "WSASend", "ConnectEx":
			return true
		}
	case *Error:
		switch e.Code {
		case "InternalError", "NoSuchUpload", "NoSuchBucket", "RequestTimeout":
			return true
		}
	// let's handle tls handshake timeout issues and similar temporary errors
	case net.Error:
		return e.Temporary()
	}

	return false
}

func hasCode(err error, code string) bool {
	s3err, ok := err.(*Error)
	return ok && s3err.Code == code
}

// ioTimeoutConn is a net.Conn which sets a deadline for each Read or Write operation
type ioTimeoutConn struct {
	*net.TCPConn
	readTimeout     time.Duration
	writeTimeout    time.Duration
	requestDeadline time.Time
}

func (c *ioTimeoutConn) deadline(timeout time.Duration) time.Time {
	dl := time.Now().Add(timeout)
	if c.requestDeadline.IsZero() || dl.Before(c.requestDeadline) {
		return dl
	}

	return c.requestDeadline
}

func (c *ioTimeoutConn) Read(b []byte) (int, error) {
	if c.readTimeout > 0 {
		err := c.TCPConn.SetReadDeadline(c.deadline(c.readTimeout))
		if err != nil {
			return 0, err
		}
	}
	return c.TCPConn.Read(b)
}

func (c *ioTimeoutConn) Write(b []byte) (int, error) {
	if c.writeTimeout > 0 {
		err := c.TCPConn.SetWriteDeadline(c.deadline(c.writeTimeout))
		if err != nil {
			return 0, err
		}
	}
	return c.TCPConn.Write(b)
}
