function redact(value) {
  return String(value || '')
    .replace(/(authorization|cookie|token|password|secret|api[_-]?key)\s*[:=]\s*[^,\s]+/gi, '$1=[redacted]')
    .slice(0, 2000);
}

function captureException(error, context = {}) {
  const event = {
    level: 'error',
    service: 'uda-backend',
    timestamp: new Date().toISOString(),
    message: redact(error?.message || error),
    request: {
      method: context.method,
      path: context.path,
      requestId: context.requestId,
    },
  };
  console.error(JSON.stringify(event));
}

module.exports = { captureException };
