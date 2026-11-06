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
    return "Your API access token is missing or invalid. Reconnect in Settings.";
  if (error.status === 403)
    return "This credential role does not permit that operation. Reconnect with the appropriate Buyer, Approver, or Admin credential.";
  if (error.status === 404)
    return "This record no longer exists. Refresh the workspace.";
  if (error.status >= 500)
    return "The API or database is unavailable. A submitted write may already have committed; refresh and check the record before retrying.";
  return (
    details(error.error).slice(0, 6).join(" ") ||
    `Request failed (${error.status}). Refresh and check the current record.`
  );
}
