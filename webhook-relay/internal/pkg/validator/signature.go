package validator

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
)

// VerifyHMACSHA256 validates the inbound webhook signature using constant-time comparison.
func VerifyHMACSHA256(payload []byte, signatureHeader string, secret string) error {
	// 1. Enforce the "sha256=" prefix format
	parts := strings.SplitN(signatureHeader, "=", 2)
	if len(parts) != 2 || parts[0] != "sha256" {
		return errors.New("invalid signature format: must be sha256=<hex>")
	}

	// 2. Decode the received hex signature
	receivedSig, err := hex.DecodeString(parts[1])
	if err != nil {
		return errors.New("invalid signature hex encoding")
	}

	// 3. Compute the expected HMAC on the RAW payload bytes
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	expectedSig := mac.Sum(nil)

	// 4. Constant-time comparison to prevent timing attacks
	if !hmac.Equal(receivedSig, expectedSig) {
		return errors.New("invalid webhook signature")
	}

	return nil
}