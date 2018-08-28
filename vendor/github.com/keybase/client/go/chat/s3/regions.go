package s3

type Region struct {
	Name                 string // the canonical name of this region.
	S3Endpoint           string
	S3BucketEndpoint     string
	S3LocationConstraint bool // true if this region requires a LocationConstraint declaration.
	S3LowercaseBucket    bool // true if the region requires bucket names to be lower case.
}

var USEastAccelerated = Region{
	Name:             "us-east-1",
	S3Endpoint:       "https://s3.amazonaws.com",
	S3BucketEndpoint: "https://${bucket}.s3-accelerate.amazonaws.com",
}
