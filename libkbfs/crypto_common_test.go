package libkbfs

import "testing"

func TestCryptoCommonEncryptDecryptBlock(t *testing.T) {
	codec := NewCodecMsgpack()
	c := CryptoCommon{codec}

	block := TestBlock{42}
	key := BlockCryptKey{}

	plainSize, encryptedBlock, err := c.EncryptBlock(block, key)
	if err != nil {
		t.Fatal(err)
	}

	if plainSize > len(encryptedBlock) {
		t.Errorf("plainSize=%d > encryptedSize=%d", plainSize, len(encryptedBlock))
	}

	var decryptedBlock TestBlock
	err = c.DecryptBlock(encryptedBlock, key, &decryptedBlock)
	if err != nil {
		t.Fatal(err)
	}

	if block != decryptedBlock {
		t.Errorf("Expected block %v got %v", block, decryptedBlock)
	}
}
