# Spottied — 디스코그래피 디깅 트래커

아티스트의 디스코그래피를 **순서대로 파고드는(디깅)** 행위를 기록하는 1인용
로컬 웹앱입니다. 음악은 재생하지 않습니다 — 청취는 Spotify에서 하고, 이 앱은
플레이어처럼 생긴 UI로 **디깅 상태**를 보여줍니다.

- **트랙** = 평가의 단위 (청취 기록 · 좋아요 · 별점)
- **앨범** = 진행의 단위 (순서대로 들어나가는 컨테이너, 독립 별점 가능)
- **아티스트** = 완주의 단위 (아티스트당 하나의 디깅 프로젝트)

모든 데이터는 브라우저의 IndexedDB에만 저장됩니다. 서버도 계정도 없습니다.

## 디자인

화이트 베이스 + **리퀴드 글라스**. 표면(카드·바·시트)은 반투명하게 뒤를 비추고
(`backdrop-filter: blur + saturate + brightness`), 흰색 스펙큘러 림과 다층
그림자로 떠 있는 유리처럼 보이게 합니다. `backdrop-filter`를 지원하지 않는
브라우저에는 불투명한 흰색 폴백이 적용됩니다.

색은 전부 커버 아트에서 옵니다. 아티스트/앨범 페이지와 디깅 카드 뒤에는 커버를
1.4배로 확대·블러한 앰비언트 배경이 깔리고, 캔버스 샘플링으로 뽑은 도미넌트
컬러가 진행 바·링·버튼·범위 토글의 액센트가 됩니다. 흰 배경 위에서 흰 글씨를
얹어도 읽히도록 액센트는 자동으로 어둡게 보정됩니다(`src/utils/color.ts`).

## 기술 스택

React 18 · TypeScript(strict) · Vite · Tailwind CSS · Zustand · Dexie.js ·
HashRouter · Recharts · Spotify Web API (Authorization Code + PKCE, 완전
클라이언트 사이드)

## 1. Spotify Developer Dashboard 설정

1. <https://developer.spotify.com/dashboard> 에서 로그인 후 **Create app**.
2. 앱 이름/설명은 자유롭게 입력합니다.
3. **Redirect URI**에 아래 값을 *정확히* 등록합니다 (마지막 슬래시 포함):

   ```
   https://kingjnu-sakayume.github.io/spottied/
   ```

   로컬 개발도 하려면 다음도 추가합니다 (Spotify는 HTTPS 또는 루프백 IP만
   허용하므로 `localhost` 대신 `127.0.0.1`을 사용하고, Vite `base` 때문에
   경로가 `/spottied/`입니다):

   ```
   http://127.0.0.1:5173/spottied/
   ```

   로컬 개발 시에는 `http://127.0.0.1:5173/spottied/`로 접속하세요.

4. **Web API**를 선택하고 저장합니다.
5. 앱 설정 화면에서 **Client ID**를 복사합니다. (Client Secret은 PKCE에
   필요 없으며, 절대 코드에 넣지 않습니다.)
6. 프로젝트 루트에 `.env.local` 파일을 만들고 붙여넣습니다:

   ```
   VITE_SPOTIFY_CLIENT_ID=여기에_클라이언트_ID
   ```

7. **User Management에 본인 계정을 추가합니다 (필수).** 앱 설정의
   **User Management**에서 앱을 사용할 Spotify 계정의 **이름과 이메일**을
   등록하세요. 개발 모드(Development Mode) 앱은 여기에 등록된 계정만
   카탈로그(검색·아티스트·앨범)를 조회할 수 있습니다. 이걸 빠뜨리면 검색이
   `400 Invalid limit`으로 실패하는데, 이 메시지는 Spotify가 주는 잘못된
   힌트입니다 — limit 값과는 무관하고 권한 문제입니다.
8. GitHub 저장소에도 같은 값을 시크릿으로 등록합니다:
   **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `VITE_SPOTIFY_CLIENT_ID`
   - Value: 복사한 Client ID

요청 스코프는 `user-read-recently-played` 하나뿐입니다 (최근 재생 동기화 용).

### 문제가 생기면

| 증상 | 원인 |
| --- | --- |
| 검색이 `400 Invalid limit`으로 실패 | 위 7번(User Management 등록)을 빠뜨린 경우. limit 값과 무관합니다. |
| 설정에 `Client ID: (설정되지 않음)` | `VITE_SPOTIFY_CLIENT_ID` 시크릿 없이 빌드된 경우. 등록 후 재배포하세요. |
| 로그인 후 돌아왔는데 연결이 안 됨 | Redirect URI가 대시보드 등록값과 정확히 일치하지 않는 경우 (슬래시까지). |

설정 화면 하단에 앱이 실제로 사용 중인 **Redirect URI와 Client ID**가 표시되니
대시보드 값과 대조해 보세요.

## 2. GitHub Pages 배포

1. 저장소 **Settings → Pages → Build and deployment → Source**를
   **GitHub Actions**로 설정합니다.
2. 위 1-7의 시크릿(`VITE_SPOTIFY_CLIENT_ID`)이 등록되어 있는지 확인합니다.
3. `main` 브랜치에 푸시하면 `.github/workflows/deploy.yml` 워크플로가
   테스트 → 빌드 → 배포를 자동으로 수행합니다.
4. 배포 주소: `https://kingjnu-sakayume.github.io/spottied/`
   - Vite `base`가 `/spottied/`로 설정되어 있습니다. 저장소 이름을 바꾸면
     `vite.config.ts`의 `base`와 Spotify Redirect URI도 함께 바꿔야 합니다.

## 3. 로컬 개발

```bash
npm install
npm run dev        # http://localhost:5173/
npm test           # derive.ts 단위 테스트 (vitest)
npm run build      # tsc --noEmit + vite build
```

## 4. 백업은 습관입니다 (중요)

이 앱은 서버가 없습니다. 모든 기록(아티스트, 앨범, 트랙 상태, 청취 로그,
평점, 메모)은 **지금 쓰는 브라우저의 IndexedDB에만** 존재합니다.

- 브라우저 데이터/사이트 데이터를 지우면 **모든 기록이 사라집니다.**
- iOS Safari는 오래 방문하지 않은 사이트의 저장소를 정리할 수 있습니다.
- **설정 → JSON 내보내기**로 주기적으로 백업하세요. 마지막 백업이 30일을
  넘고 새 기록이 있으면 홈에 알림 배너가 뜹니다.
- 복원은 **설정 → JSON 가져오기**에서 병합 또는 전체 교체로 할 수 있습니다.

## 구조

```
src/
├── lib/spotify/    # pkce.ts, client.ts(자동 갱신 + 429 대응), endpoints.ts
├── db/             # dexie.ts(스키마 버전 체인), backup.ts(내보내기/가져오기)
├── store/          # artistStore, logStore, uiStore (Zustand)
├── utils/derive.ts # 진행률·상태·이어듣기 지점 (순수 함수, 테스트 포함)
├── utils/color.ts  # 커버 아트 도미넌트 컬러 추출
├── components/     # GlassCard, NowDiggingBar, StarRating, TrackRow, ...
└── pages/          # 홈 / 검색 / 아티스트 / 앨범 / 프로필 / 설정
```

v2 업적 시스템 설계는 [docs/v2-achievements.md](docs/v2-achievements.md)에
기록되어 있습니다 (v1에서는 구현하지 않음).
