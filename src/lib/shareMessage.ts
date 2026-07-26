/** Clipboard / share-sheet style trip invite (title + blurb + URL). */
export function buildTripShareMessage(title: string, text: string, url: string): string {
  return `${title}\n${text}\n\n${url}`
}
