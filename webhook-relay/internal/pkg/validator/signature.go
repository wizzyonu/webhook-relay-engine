package validator

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
)

var ErrInvalidSignature = errors.New("invalid webhook signature")

// VerifyHMACSHA256 verifies the signature of a payload.
// Expected header format: "sha256=<hex_digest>"
func VerifyHMACSHA256(payload []byte, signatureHeader string, secret string) error {
	if !strings.HasPrefix(signatureHeader, "sha256=") {
		return ErrInvalidSignature
	}

	expectedSig := strings.TrimPrefix(signatureHeader, "sha256=")
	expectedBytes, err := hex.DecodeString(expectedSig)
	if err != nil {
		return fmt.Errorf("failed to decode signature hex: %w", err)
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	computedBytes := mac.Sum(nil)

	if !hmac.Equal(computedBytes, expectedBytes) {
		return ErrInvalidSignature
	}

	return nil
}