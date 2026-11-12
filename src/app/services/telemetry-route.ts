const LITERAL = /^[a-z][a-z-]{0,30}$/;
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

// Conserva solo segmentos literales en minúsculas; todo lo demás (ids, tokens) pasa a :id.
export function normalizeTelemetryPath(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean).slice(0, 7)
    .map((segment) => (LITERAL.test(segment) ? segment : ':id'));
  return `/${segments.join('/')}`;
}

export function failedRequestDetails(method: string, pathname: string, status: unknown, page: string):
  { http?: { method: string; route: string; statusCode: number }; page: string } {
  const upper = method.toUpperCase();
  const statusCode = typeof status === 'number' && Number.isInteger(status) && status >= 0 && status <= 599 ? status : 0;
  const route = normalizeTelemetryPath(pathname);
  return {
    page: normalizeTelemetryPath(page),
    ...(METHODS.has(upper) && route.startsWith('/api/') ? { http: { method: upper, route, statusCode } } : {})
  };
}
