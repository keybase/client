package kvstore

import "encoding/base64"

func Box(cleartext string) (ciphertext string, err error) {
	clearBytes := []byte(cleartext)
	return base64.StdEncoding.EncodeToString(clearBytes), nil
}

func Unbox(ciphertext string) (cleartext string, err error) {
	cipherBytes, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}
	return string(cipherBytes), nil
}
