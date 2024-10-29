const { extractTraceContext, replaceTraceID, correctSpansForTrace } = require("./utils/trace");
const sendEventPayload = require("./utils/request");
const Sentry = require('@sentry/node');
require('dotenv').config();

const SPAN_TRACKING_SERVICE_URL = process.env.SPAN_TRACKING_SERVICE_URL;

function SpanBatchTransport(options) {
    function makeRequest(request) {
        const contexts = extractTraceContext(request.body);
        if (contexts.type !== "transaction") return;

        const requestOptions = getRequestOptions(
            JSON.stringify({
                traceId: contexts.traceContext.trace_id,
                numOfSpans: contexts.spans.length
            }),
            {
                'Content-Type': 'application/json',
                ...options.headers
            }
        )

        try {
            return fetch(SPAN_TRACKING_SERVICE_URL, requestOptions).then(response => {
                return response.json().then(jsonResponse => {
                    if (!jsonResponse.spanLimitReached) {
                        return sendEventPayload(
                            options.url, 
                            getRequestOptions(request.body, options.headers)
                        );
                    } else {
                        let traces = {}
                        if (jsonResponse.numOfSpansExceeded > 0) {
                            traces = correctSpansForTrace(request.body, jsonResponse.numOfSpansExceeded);
                            sendEventPayload(
                                options.url, 
                                getRequestOptions(traces.currentTrace, options.headers)
                            )
                        }
                        let trace_id = null;
                        let parent_span_id = null;

                        Sentry.startNewTrace(() => {
                          trace_id = Sentry.getCurrentScope().getPropagationContext().traceId;
                          parent_span_id = Sentry.getCurrentScope().getPropagationContext().spanId;
                        });

                        const body = replaceTraceID(
                            traces.newTrace,
                            trace_id,
                            parent_span_id
                        )
                        return sendEventPayload(
                            options.url,
                            getRequestOptions(body, options.headers)
                        )
                    }
                })
            })
        } catch (error) {
            console.log(error);
        }
    }

    return Sentry.createTransport(options, makeRequest) 
}

function getRequestOptions(body, headers) {
    return {
        body,
        method: 'POST',
        headers
    }
}

module.exports = { SpanBatchTransport} ;

