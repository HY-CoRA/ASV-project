# ASV-project — 코딩으로 쌓는 '병맛' 효도 케이크

안산 사이언스 밸리(ASV) 부스용 블록 코딩 교육 게임. 블록으로 짠 순서대로 캐릭터 '나우'가 8×8 마트를 돌며 재료를 집고, 집은 순서 그대로 케이크가 쌓인다.

- 플레이: https://hy-cora.github.io/ASV-project/ (GitHub Pages)
- 기획·규칙·미결 사항: [docs/spec.md](docs/spec.md)
- 캐릭터·의상·장바구니 꾸미기: [docs/wardrobe.md](docs/wardrobe.md)

인트로의 꽃길과 햇살 마트, 재료 도트는 프로젝트용으로 직접 그린 SVG입니다. 풍경은 `assets/sunny-village.svg`, 재료 그림은 `js/journey-art.js`에 있습니다.

## 실행

빌드 없음. `index.html`을 브라우저로 열면 된다. (파일로 직접 열어도 되고, 로컬 서버를 띄워도 된다.)

```bash
python3 -m http.server 8000   # http://localhost:8000
```

## 구조

```
index.html          화면 마크업 (인트로 / 코딩·실행 / 결과)
css/style.css       스타일
js/engine.js        게임 엔진 — 맵, 인터프리터, 점수 계산. DOM 의존 없음 (node로 테스트 가능)
js/app.js           UI — Blockly 블록 정의, 지도 렌더, 실행 루프, 결과 화면, 명예의 전당(localStorage)
vendor/             Blockly 13.3.0 (blockly.min.js, 한국어 메시지). Apache-2.0
test/engine.test.js 엔진 테스트 (풀이 가능성, 점수표, 폭발/빈손/계산대 엔딩)
docs/spec.md        개발 명세
```

## 테스트

```bash
node test/engine.test.js   # 마지막 줄 ALL OK
node test/wardrobe.test.js # 꾸미기 저장 데이터 및 방향 검사
```

## 배포

`main` 브랜치 루트를 GitHub Pages로 서빙한다. Settings → Pages → Build and deployment: Deploy from a branch, `main` / `/ (root)`. 푸시하면 1~2분 내 반영.

## 레벨 / 부스 운영

| 레벨 | 대상 | 주소 |
|---|---|---|
| 1 첫 장보기 (3층) | 초등 저학년·입문 | `?level=1` |
| 2 반복의 힘 (6층) | 초등 고학년·중등 | `?level=2` |
| 3 미로 마트 (6층, 기획서 원본 맵) | 중등·챌린지 | `?level=3` |

노트북마다 다른 레벨을 띄우려면 주소 뒤에 `?level=2&lock=1`처럼 붙인다. `lock=1`이면 인트로에서 레벨 선택이 숨겨져 아이들이 못 바꾼다. 명예의 전당은 브라우저(localStorage)별·레벨별 저장이라 기기 간에 합쳐지지 않는다.

## 규칙 요약

- 레시피: 빵 → 생크림 → 빵 → 생크림 → 토핑 → 초 (6층)
- 블록: 앞으로 / 왼쪽 돌기 / 오른쪽 돌기 / 앞 물건 집기 / N번 반복 / 만약(벽 있음·없음·빵 집음·생크림 집음)
- 물건 선반은 지나갈 수 없고 앞에서 집는다
- 점수: 정상 +50, 순서 오류 −10, 이상한 재료 −20, 다이너마이트 −100 (즉시 폭발)
- 순위: 점수 ↓ → 블록 수 ↑ → 동작 수 ↑
