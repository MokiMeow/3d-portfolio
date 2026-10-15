/**
 * Big pictures (star maps, panoramas) are decoded by the browser in the background before the GPU sees
 * them. Without this, the first frame that uses one decodes it on the main thread and the page stalls.
 * `decode()` exists in every current browser; where it fails, the picture is simply used as it is.
 */
export async function decoded<T>(image: T): Promise<T> {
  const picture = image as unknown as { decode?: () => Promise<void> };
  if (picture && typeof picture.decode === 'function') await picture.decode().catch(() => undefined);
  return image;
}
