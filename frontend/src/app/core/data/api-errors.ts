import { TimeoutError } from "rxjs";
import { HttpErrorResponse } from "@angular/common/http";
function details(value: unknown, path = ""): string[] {
  if (typeof value === "string") return [path ? `${path}: ${value}` : value];
  if (Array.isArray(value))
    return value.flatMap((item, index) =>
      details(item, typeof item === "string" ? path : `${path}[${index + 1}]`),
    );
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([key, item]) =>
      details(
        item,
        key === "detail" || key === "non_field_errors"
          ? path
          : [path, key.replaceAll("_", " ")].filter(Boolean).join(" / "),
      ),
    );
  return [];
}
export function apiError(error: unknown): string {
  if (error instanceof TimeoutError)
    return "The API request timed out. A submitted write may already have committed; refresh and check the record before retrying.";
  if (!(error instanceof HttpErrorResponse))
    return error instanceof Error
      ? error.message
      : "The request could not be completed.";
  if (error.status >= 200 && error.status < 300)
    return "The server response could not be read. A write may already have committed; refresh and check the record before retrying.";
  if (error.status === 0)
    return "Cannot reach Django. Check the server, API URL, network, and CORS settings. The outcome of a submitted write may be unknown; refresh before retrying.";
  if (error.status === 401)
    return "Your session has expired or you are signed out. Log in to continue.";
  if (error.status === 403)
    return "Access denied. Your assigned role does not permit this operation, or the security token has expired. Refresh and try again.";
  if (error.status === 404)
    return "This record no longer exists. Refresh the workspace.";
  if (error.status === 503 && error.error?.code === 'authentication_setup_required')
    return 'Accounts are not ready. Ask an administrator to finish database setup.';
  if (error.status >= 500)
    return "The API or database is unavailable. A submitted write may already have committed; refresh and check the record before retrying.";
  return (
    details(error.error).slice(0, 6).join(" ") ||
    `Request failed (${error.status}). Refresh and check the current record.`
  );
}
