function extractTraceContext(jsonString) {
    // Split by newlines to process each potential JSON string separately
    const lines = jsonString.split('\n');

    for (const line of lines) {
      try {
        const jsonData = JSON.parse(line);
  
        // Check if the parsed object contains `contexts.trace`
        if (jsonData.contexts && jsonData.contexts.trace) {
          const traceContext = jsonData.contexts.trace;

          const spans = jsonData.spans ? jsonData.spans : [];
          const type = jsonData.type;
          return { traceContext, spans, type };
        }
      } catch (error) {
        continue;
      }
    }
  
    return "No trace context found in the provided JSON.";
}

function replaceTraceID(event, trace_id, parent_span_id) {
    const lines = event.split('\n');
    let jsonString = '';
    for (const line of lines) {
      const jsonData = JSON.parse(line);
      if (jsonData.trace) {
        jsonData.trace.trace_id = trace_id;
      }

      if (jsonData.contexts && jsonData.contexts.trace) {
        jsonData.contexts.trace.trace_id = trace_id;
        jsonData.contexts.trace.span_id = parent_span_id;
      }

      if (jsonData.spans) {
        for (let span of jsonData.spans) {
          span.trace_id = trace_id;
          span.parent_span_id = parent_span_id;
        }
      }

      jsonString +=  JSON.stringify(jsonData) + '\n';
    }

    return jsonString;
}

function correctSpansForTrace(event, numOfSpansExceeded) {
    const lines = event.split('\n');
    let newTrace = '';
    let currentTrace = '';
    for (let line of lines) {
      const jsonData = JSON.parse(line);
      if (!jsonData.contexts) {
        if (jsonData.event_id) {
          delete jsonData.event_id;
          line = JSON.stringify(jsonData)
        }

        newTrace += `${line}\n`;
        currentTrace += `${line}\n`
      } else {
        let propertiesNewJSON = {}
        let propertiesCurrentJSON = {}
        for (const property in jsonData){
          if (property == "spans") {
            let spansForCurrentTrace = jsonData[property].slice(0, numOfSpansExceeded);
            let spansForNewTrace = jsonData[property].slice(numOfSpansExceeded);
            propertiesNewJSON[property] = spansForNewTrace;
            propertiesCurrentJSON[property] = spansForCurrentTrace;
          } else {
            propertiesNewJSON[property] = jsonData[property];
            propertiesCurrentJSON[property] = jsonData[property];
          }
        }
        newTrace += JSON.stringify(propertiesNewJSON);
        currentTrace += JSON.stringify(propertiesCurrentJSON);
      }
    }
    return { newTrace, currentTrace }
  }

module.exports =  {extractTraceContext, replaceTraceID, correctSpansForTrace};