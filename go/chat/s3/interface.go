package s3

import (
	"github.com/keybase/client/go/libkb"
	"io"

	"golang.org/x/net/context"
)

type Root interface {
	New(g *libkb.GlobalContext, signer Signer, region Region) Connection
}

type Connection interface {
	SetAccessKey(key string)
	Bucket(name string) BucketInt
}

type BucketInt interface {
	GetReader(ctx context.Context, path string) (rc io.ReadCloser, err error)
	GetReaderWithRange(ctx context.Context, path string, begin, end int64) (rc io.ReadCloser, err error)
	PutReader(ctx context.Context, path string, r io.Reader, length int64, contType string, perm ACL, options Options) error
	Multi(ctx context.Context, key, contType string, perm ACL) (MultiInt, error)
	Del(ctx context.Context, path string) error
}

type MultiInt interface {
	ListParts(ctx context.Context) ([]Part, error)
	Complete(ctx context.Context, parts []Part) error
	PutPart(ctx context.Context, n int, r io.ReadSeeker) (Part, error)
}
