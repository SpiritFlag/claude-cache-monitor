# Cache Monitor for Claude Code

Claude Code 트랜스크립트를 실시간으로 지켜보며 캐시 상태와 비용을 보여주는 계기판.

> 이 프로그램은 **Anthropic과 아무 관계가 없는 비공식 도구**입니다. Anthropic이 만들거나, 보증하거나, 후원하지 않습니다. Claude와 Claude Code는 Anthropic PBC의 상표입니다.

## 이게 뭔가

`~/.claude/projects/**/*.jsonl`에 쌓이는 트랜스크립트를 지켜보다가, 프롬프트 캐시가 언제 만료되는지 · 지금 깨뜨리면 얼마인지 · 컨텍스트가 무엇으로 차 있는지를 브라우저 화면 하나에 띄웁니다. 입력은 받지 않고 읽기만 하므로, 작업은 평소대로 하고 이 창은 옆 모니터에 걸어둡니다.

```
~/.claude/projects/*.jsonl  ──watch──▶  server.js  ──SSE──▶  브라우저 계기판
```

캐시 TTL 카운트다운, 컨텍스트 구성 톱니 그래프, 세션 비용과 다른 모델이었을 때의 비교, 압축이 남긴 폐기물과 지금까지 아낀 값, 캐시를 깨는 습관 순위, 상태에 따라 바뀌는 캐릭터를 봅니다.

## 설치

**Node 18 이상**만 있으면 됩니다. 의존성은 없습니다.

```bash
git clone https://github.com/SpiritFlag/claude-cache-monitor.git
cd claude-cache-monitor
```

## 사용

Windows:

```
start-monitor.cmd
```

Linux · macOS:

```bash
chmod +x start-monitor.sh
./start-monitor.sh
```

기본값은 `~/.claude/projects`와 포트 7777이고 브라우저가 자동으로 열립니다. 폴더와 포트를 지정하려면 인자로 넘깁니다.

```bash
./start-monitor.sh ~/other 7780
```

런처 없이 직접 띄울 수도 있습니다.

```bash
node server.js [--dir <projectsDir>] [--port <port>]
```

원격 서버에 띄우는 방법, Windows에서 콘솔 창 없이 돌리는 방법, 캐시가 덜 깨지게 하는 설정은 [docs/guide.md](docs/guide.md)에 있습니다.

## 구조

```
.
├── server.js          폴더 watch · 증분 파싱 · SSE 서버
├── index.html         화면 (요청마다 읽으므로 고친 뒤 새로고침만 하면 됨)
├── start-monitor.cmd  Windows 런처
├── start-monitor.sh   Linux · macOS 런처
├── character-spec.md  캐릭터 상태 정의와 생성 프롬프트
├── img/               캐릭터 이미지
├── scripts/           진단 스크립트
├── test/              판정 테스트와 합성 픽스처
└── docs/              설계 근거 · 운영 안내 · 사이클 기록
```

## 더 보기

- [docs/design.md](docs/design.md) — 수치를 어떻게 뽑고 어떻게 읽는가
- [docs/guide.md](docs/guide.md) — 원격 서버 설치, 창 없이 띄우기, 캐시 깨짐 줄이는 설정
- [CONTRIBUTING.md](CONTRIBUTING.md) — 이슈 · 브랜치 · 사이클
- [Releases](https://github.com/SpiritFlag/claude-cache-monitor/releases) — 버전별 변경 내역
- 라이선스는 [MIT](LICENSE)입니다. 다시 적자면 이 프로그램은 Anthropic과 아무 관계가 없는 비공식 도구입니다.
