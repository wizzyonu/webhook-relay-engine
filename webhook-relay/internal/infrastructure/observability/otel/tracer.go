package otel

import (
	"context"
	"log"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/stdout/stdouttrace"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
)

// InitTracer sets up the OpenTelemetry TracerProvider.
func InitTracer(serviceName string) (*sdktrace.TracerProvider, error) {
	// 1. Create Exporter (Using stdout for local dev; swap to Jaeger/OTLP in prod)
	exporter, err := stdouttrace.New(stdouttrace.WithPrettyPrint())
	if err != nil {
		return nil, err
	}

	// 2. Define Resource (Attributes identifying the service)
	res, err := resource.New(context.Background(),
		resource.WithAttributes(
			semconv.ServiceNameKey.String(serviceName),
		),
	)
	if err != nil {
		return nil, err
	}

	// 3. Initialize TracerProvider
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
	)

	// 4. Set Global Propagator (W3C Trace Context)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	// 5. Set Global TracerProvider
	otel.SetTracerProvider(tp)

	log.Println("OpenTelemetry Tracer initialized.")
	return tp, nil
}