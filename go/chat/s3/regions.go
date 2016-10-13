package s3

import "github.com/goamz/goamz/aws"

var USEastAccelerated = aws.Region{
	Name:             "us-east-1",
	S3Endpoint:       "https://s3.amazonaws.com",
	S3BucketEndpoint: "https://${bucket}.s3-accelerate.amazonaws.com",
}
