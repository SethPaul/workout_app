/**
 * Turns a free-text name into a URL/id-safe slug, e.g. "Band Tricep Extension"
 * -> "band_tricep_extension". Shared by `src/ui/helpers.ts` (movement editor)
 * and `src/domain/vasa/library.ts` (SPEC 10.3 `newVasaMovement`) — kept here
 * so the domain layer never imports from `src/ui/`.
 */
export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
