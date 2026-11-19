export interface MediaUploadProgress {
  /** Files finished, successfully or not. */
  done: number;
  total: number;
  failed: number;
}

export interface MediaUploadFailure<T> {
  file: T;
  message: string;
}

/**
 * Attach many files, a few at a time, retrying each once.
 *
 * The crew reported on 20 November that ten photos on one daily log attached
 * none, and a single photo on the retry attached fine. Nothing was rejecting
 * them: the uploads ran strictly one after another, fire-and-forget, while the
 * toast already said "Daily log submitted". One photo on a phone on site took
 * about ten seconds, so ten took the best part of two minutes - and the moment
 * he closed the app, the browser suspended the tab and every upload still in
 * the queue died without a word.
 *
 * Three at a time cuts that wait to roughly a third. The retry covers the
 * ordinary dropped request on site. Neither helps if the app is closed, so the
 * caller owes the person a visible "still uploading" state - the point of
 * `onProgress` - which is the part that actually fixes his ten photos.
 */
export async function uploadAllMedia<T>(
  files: T[],
  upload: (file: T) => Promise<unknown>,
  options: { concurrency?: number; attempts?: number; onProgress?: (progress: MediaUploadProgress) => void } = {},
): Promise<{ failures: MediaUploadFailure<T>[] }> {
  const { concurrency = 3, attempts = 2, onProgress } = options;
  const total = files.length;
  const failures: MediaUploadFailure<T>[] = [];
  let done = 0;
  let next = 0;

  const report = () => onProgress?.({ done, total, failed: failures.length });
  report();

  const worker = async () => {
    for (let index = next++; index < total; index = next++) {
      const file = files[index];
      let lastError: unknown;
      for (let attempt = 1; attempt <= Math.max(1, attempts); attempt++) {
        try {
          await upload(file);
          lastError = undefined;
          break;
        } catch (err) {
          lastError = err;
        }
      }
      // A file that still will not go up is named, not swallowed. Order follows
      // the list the person picked, not whichever worker lost first.
      if (lastError) failures.push({ file, message: (lastError as Error)?.message || "Upload failed" });
      done++;
      report();
    }
  };

  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), total) }, worker));
  failures.sort((a, b) => files.indexOf(a.file) - files.indexOf(b.file));
  return { failures };
}

/** What to tell someone once the uploads have stopped. */
export function mediaUploadSummary<T>(total: number, failures: MediaUploadFailure<T>[]) {
  const attached = total - failures.length;
  if (total === 0) return "";
  if (!failures.length) return `${total} ${total === 1 ? "file" : "files"} attached to the daily log.`;
  if (attached === 0) {
    return total === 1
      ? `The photo did not attach: ${failures[0].message}`
      : `None of the ${total} photos attached: ${failures[0].message}`;
  }
  return `${attached} of ${total} attached. ${failures.length} failed: ${failures[0].message}`;
}
