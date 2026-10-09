# ASV-project — 코딩으로 쌓는 '병맛' 효도 케이크

안산 사이언스 밸리(ASV) 부스용 블록 코딩 교육 게임. 블록으로 짠 순서대로 캐릭터 '나우'가 8×8 마트를 돌며 재료를 집고, 집은 순서 그대로 케이크가 쌓인다.

- 플레이: https://hy-cora.github.io/ASV-project/ (GitHub Pages)
- 기획·규칙·미결 사항: [docs/spec.md](docs/spec.md)

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
```

## 배포

`main` 브랜치 루트를 GitHub Pages로 서빙한다. Settings → Pages → Build and deployment: Deploy from a branch, `main` / `/ (root)`. 푸시하면 1~2분 내 반영.

## 규칙 요약

- 레시피: 빵 → 생크림 → 빵 → 생크림 → 토핑 → 초 (6층)
- 블록: 앞으로 / 왼쪽 돌기 / 오른쪽 돌기 / 앞 물건 집기 / N번 반복 / 만약(벽 있음·없음·빵 집음·생크림 집음)
- 점수: 정상 +50, 순서 오류 −10, 이상한 재료 −20, 다이너마이트 −100 (즉시 폭발)
- 순위: 점수 ↓ → 블록 수 ↑ → 동작 수 ↑
