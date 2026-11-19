/** yt-stats.py의 norm_title: 해시태그와 문자·숫자 외 기호를 지우고 소문자로 */
export function normalizeTitle(title: string | null | undefined): string {
  return (title ?? "")
    .replace(/#\S+/g, "")
    .replace(/[^\p{L}\p{N}_]+/gu, "")
    .toLowerCase();
}
