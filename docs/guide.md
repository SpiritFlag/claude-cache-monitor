# 운영 안내

설치와 기본 실행은 [README](../README.md)에 있다. 여기에는 원격 서버에 띄우는 방법과 캐시가 덜 깨지게 하는 설정을 적는다.

## 원격 서버에 띄우기

서버에는 브라우저가 없으므로 로컬 PC에서 SSH 포트 포워딩으로 본다.

```bash
ssh -L 7777:localhost:7777 ubuntu@<서버-주소>
```

그다음 로컬 브라우저에서 `http://localhost:7777`을 연다. 서버는 localhost에만 바인딩되므로 외부에 노출되지 않는다.

백그라운드로 계속 띄워두려면:

```bash
nohup node ~/claude-cache-monitor/server.js > ~/cc-monitor.log 2>&1 &
```

systemd로 등록하려면 `/etc/systemd/system/cc-monitor.service`에:

```ini
[Unit]
Description=cc-monitor
After=network.target

[Service]
User=ubuntu
ExecStart=/usr/bin/node /home/ubuntu/claude-cache-monitor/server.js --port 7777
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now cc-monitor
```

Linux에서 `fs.watch`의 재귀 감시가 지원되지 않는 Node 버전이면 자동으로 2초 폴링으로 내려간다. 기동 로그에 `polling every 2s`가 찍히면 그 상태다.

## 캐시 깨짐 줄이기

플러그인 스킬이 프론트매터에 `effort`를 박아 두면 스킬을 드나들 때마다 effort가 바뀌고 컨텍스트 전체가 다시 쓰인다. `~/.claude/settings.json`에 다음을 넣으면 스킬이 effort를 덮어쓰지 못한다.

```json
{
  "env": {
    "CLAUDE_CODE_EFFORT_LEVEL": "high"
  }
}
```

기존 키는 그대로 두고 `env`만 추가한다. 이미 `env`가 있으면 그 안에 한 줄을 넣는다. `effortLevel` 키는 스킬이 덮어쓰므로 쓰지 않는다.

확인하는 법: 새 세션에서 스킬을 하나 부른 뒤 계기판의 상태 띠에서 effort가 바뀌지 않고 캐릭터가 깨짐 상태로 넘어가지 않으면 걸린 것이다.
