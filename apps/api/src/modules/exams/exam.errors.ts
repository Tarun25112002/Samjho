import { ERROR_CODES } from "@medhavi/contracts";

import { AppError } from "../../lib/errors.js";

/**
 * The clock ran out.
 *
 * A 410 rather than a 403 or a 409, and the distinction is the one the client
 * has to act on: the attempt is *gone* as a thing that can be written to, but
 * it still exists and its result is available. A 403 would suggest the student
 * was never allowed, and a 409 would suggest retrying might work.
 */
export class ExamExpiredError extends AppError {
  readonly statusCode = 410;
  readonly code = ERROR_CODES.EXAM_EXPIRED;

  constructor(message = "Time is up on this exam.") {
    super(message);
  }
}
