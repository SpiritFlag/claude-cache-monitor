# CLAUDE.md

## cycle

- 검증: `node --test` (54건 · 3초 · **인자 없이** — 디렉터리 인자를 주면 Node 24가 그것을 모듈로 읽으려다 실패한다. `data/` 없는 환경에서 `archive-fuel` 1건이 skip되는 것은 정상이다) · 육안 확인은 사용자가 `node server.js --dir <대상> --port <빈 포트>`로 띄운 대시보드를 본다 · 수치 대조는 `curl localhost:<포트>/api/state`의 `byCause` · `breaks`
- CI 없음: `.github/workflows/`가 없어 자동 검사가 돌지 않는다. 검증은 사이클 브랜치에서 수동으로 돌리고 결과와 날짜를 do §3에 남긴다
- 릴리즈 노트: 제품명 `Cache Monitor for Claude Code`, 게임 공지 톤, 제목 이모지는 매번 고른다
- 이 도구는 Anthropic과 아무 관계가 없는 비공식 프로그램이다. README와 릴리즈 노트에 이 사실을 명시한다. 라이선스는 MIT
- 의존성 없음: `package.json`이 없다. 런타임·테스트 모두 Node 내장 모듈만 쓴다. 라이브러리를 들이려면 그 자체를 하나의 사이클로 연다
- 테스트 픽스처는 개인정보다: `~/.claude/projects/` 원본을 그대로 커밋하지 않는다. 경로 · 프롬프트 본문 · 토큰을 지우고 집계에 필요한 수치 필드만 남긴 합성 `test/fixtures/*.jsonl`로 넣는다
