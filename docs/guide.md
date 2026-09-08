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

## Windows에서 창 없이 띄우기

`start-monitor.cmd`로 띄우면 검은 콘솔 창이 계속 떠 있어야 한다. 창 없이 돌리려면 레포 폴더에 `start-monitor-hidden.vbs`를 만든다.

```vbscript
Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = here
sh.Run "node """ & here & "\server.js"" --port 7777", 0, False
WScript.Sleep 1500
sh.Run "http://localhost:7777", 1, False
```

`Run`의 두 번째 인자 `0`이 "창을 만들지 않는다"는 뜻이다. 더블클릭하면 콘솔 없이 서버가 뜨고 브라우저만 열린다. 폴더나 포트를 바꾸려면 `--dir "경로"`를 함께 넘긴다. `--dir`을 생략하면 `%USERPROFILE%\.claude\projects`를 본다.

로그인할 때 자동으로 뜨게 하려면 `Win+R`에 `shell:startup`을 쳐서 열리는 시작 프로그램 폴더에 이 `.vbs`의 바로가기를 넣는다. 로그인 전부터 돌려야 하면 작업 스케줄러에 "사용자의 로그온 여부에 관계없이 실행" + "숨겨서 실행"으로 등록한다.

PowerShell의 `Start-Process -WindowStyle Hidden`은 창이 한 번 깜빡였다 사라지는 일이 있어 `.vbs` 쪽이 확실하다.

### 끄기

창이 없으므로 작업 관리자에서 `node.exe`를 끝내거나:

```
taskkill /IM node.exe /F
```

다른 Node 프로세스까지 같이 죽으므로, 포트로 골라 죽이려면:

```
for /f "tokens=5" %a in ('netstat -aon ^| findstr :7777 ^| findstr LISTENING') do taskkill /PID %a /F
```

배치 파일 안에 넣을 때는 `%a`를 `%%a`로 쓴다.

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
