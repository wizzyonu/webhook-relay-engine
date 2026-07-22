package uuid

import (
	"github.com/elite-engineering/webhook-relay/internal/domain/ports"
	gouuid "github.com/google/uuid"
)

type Generator struct{}

func NewGenerator() ports.UUIDGenerator {
	return &Generator{}
}

func (g *Generator) New() string {
	return gouuid.New().String()
}