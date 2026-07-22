package dto

// IngestHeaders defines the strict cryptographic and routing headers required for ingestion.
// Mapped to OpenAPI spec parameters.
type IngestHeaders struct {
	Signature string `header:"X-Webhook-Signature" binding:"required"`
	TargetURL string `header:"X-Target-URL" binding:"required,url"`
}

// ListEventsQuery defines the cursor pagination and filtering parameters.
type ListEventsQuery struct {
	Cursor string `form:"cursor"`
	Limit  int    `form:"limit" binding:"min=1,max=100"`
	Status string `form:"status"` // Optional FSM filter
}

// ReplayEventRequest is currently empty as the eventId is in the path, 
// but defined here to allow future payload extensions (e.g., force_override).
type ReplayEventRequest struct{}