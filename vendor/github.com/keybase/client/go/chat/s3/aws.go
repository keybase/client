package s3

type AWS struct{}

func (a *AWS) New(signer Signer, region Region) Connection {
	return New(signer, region)
}
