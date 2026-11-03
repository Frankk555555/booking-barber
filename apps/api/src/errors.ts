export type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 429 | 500 | 503;
export class DomainError extends Error {
  constructor(
    public status: ErrorStatus,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export function insist(
  condition: unknown,
  message: string,
  status: ErrorStatus = 400,
): asserts condition {
  if (!condition) throw new DomainError(status, message);
}
