# Color Code Inspection (CCI)

휴대 장비(안전그네, 사다리, 케이블릴, 용접기 등)의 **분기별 컬러코딩 점검**을 QR 라벨로 관리하는 오프라인 웹앱입니다.
안드로이드 공용폰 1대에서 Chrome으로 사용하며, 설치 후에는 인터넷 없이 동작합니다. UI는 영어입니다.

- 앱 주소: `https://kimlin70-spec.github.io/QR_Color/` (GitHub Pages를 켠 뒤 사용 가능)
- 라벨 인쇄: 같은 주소 뒤에 `labels.html` 을 붙이거나, 저장소의 `labels_0001-0500.pdf` 를 바로 인쇄
- 원칙: **QR 라벨 = 장비 번호(고정), 테이프 색 = 육안 신호, 앱 기록 = 최종 판정**

---

## 1. 폰에 설치

1. 사무실 와이파이에서 Chrome으로 앱 주소를 엽니다.
2. Chrome 메뉴(⋮) → **홈 화면에 추가** → 홈 화면의 CCI 아이콘으로 실행합니다.
3. 첫 **SCAN** 때 카메라 허용을 누릅니다.
4. 이후에는 와이파이 없이도 실행·스캔·점검·Export가 됩니다.

새 버전이 올라오면 폰이 와이파이에 있을 때 앱을 열면 위쪽에 **"New version available – tap to update"** 띠가 뜹니다. 누르면 바뀝니다.

> 주의: 이 폰에서 Chrome의 **인터넷 사용 기록 삭제, 사이트 데이터 삭제, Chrome 앱 데이터 삭제**를 하면 장비 기록이 모두 사라집니다. 백업(7절)을 주 1회 PC로 옮겨 두세요.

## 2. 처음 한 번 설정 (Settings)

- **Inspector name**: 점검자 이름. 기본값 `Jackis`. 모든 점검 기록에 이 이름이 붙습니다.
- **Grace days**: 분기가 바뀐 뒤 직전 분기 색을 인정하는 일수. 기본 14일.
- **Quarter colours**: Q1 YELLOW, Q2 BROWN, Q3 BLUE, Q4 GREEN (이름과 색 변경 가능).
- **Equipment types / Teams**: 한 줄에 하나. `Other`는 항상 제공되며 고르면 글자를 적을 수 있습니다.

기본 종류: Harness, Ladder, Cable Reel, Light, Power Tool, Welding Machine, Chain Block, Lifeline, Anchorage Beam
기본 팀: Welder, Boiler, STG, Demin, Sewage, Electrical, Operation, Motor Shop, E&S

## 3. 라벨 인쇄 (PC)

라벨은 종류와 무관한 **번호 라벨**입니다 (`0001`, `0002`, …). QR 내용은 `CCI:0001` 형식입니다.

- 저장소의 **`labels_0001-0500.pdf`** 를 A4 레이저 프린터로 **배율 100 %** 로 인쇄합니다 (8장, 500개).
- 더 필요하면 `labels.html` 을 PC 브라우저에서 열어 **Start number**(예: 501)와 **Count**를 넣고 Print 합니다.
- 라벨 36 × 18 mm, 한 장에 65개(5 × 13). QR 14 mm, 번호 굵은 글씨.
- 각 장 위의 **50 mm 자**를 실제 자로 재서 배율이 맞는지 확인합니다.
- 라미네이트 후 점선대로 자르고 투명테이프로 장비에 한 바퀴 감아 붙입니다.
- **같은 번호 범위를 두 번 인쇄하지 않습니다.** 다음 묶음은 마지막 번호 다음부터 뽑습니다.

## 4. 현장 업무 흐름

**등록 (처음 라벨을 붙일 때)**
1. 라벨을 장비에 붙이고 **SCAN** 합니다.
2. `NOT REGISTERED` 화면에서 **REGISTER** → 종류 탭, 팀 탭 → **SAVE**.
   (마지막에 고른 종류·팀이 다음 등록의 기본값으로 선택돼 있습니다.)
3. 바로 `NOT INSPECTED` 화면이 뜹니다. **INSPECT** 를 눌러 점검하거나 **SCAN NEXT** 로 넘어갑니다.

**점검**
1. 라벨을 **SCAN** → 판정 화면 → **INSPECT**.
2. **OK – PASS** 또는 **FAIL** 한 번이면 저장됩니다.
3. PASS면 "apply GREEN tape"처럼 이번 분기 색 테이프를 감으라는 안내가, FAIL이면 "tag out & quarantine" 안내가 뜹니다.
4. 같은 분기에 다시 점검하면 확인 질문 뒤 최신 기록이 유효해지고 이전 기록은 superseded 로 남습니다.

QR이 안 읽히면 **Enter number manually** 로 라벨의 번호를 입력합니다.

**판정 화면 (스캔 결과)**

| 화면 | 뜻 |
|---|---|
| `VALID` + 분기 색 전체 화면 | 이번 분기 합격. 그 색 테이프가 붙어 있어야 함 |
| `VALID (GRACE)` + 직전 분기 색 | 분기 시작 후 유예 기간(기본 14일) 안이고 직전 분기 합격. "Inspect before 14-Jan" |
| `REJECTED – QUARANTINE` (빨강) | 이번 분기 최신 기록이 FAIL. 사용 금지, 수리 후 재점검 |
| `NOT INSPECTED – DO NOT USE` (빨강/회색 줄무늬) | 이번 분기 기록 없음. 테이프 색과 무관하게 사용 금지 |
| `RETIRED` (검정) | 퇴역 장비. 현장에서 치울 것 |
| `NOT REGISTERED` (회색) | 아직 등록 안 된 새 라벨 → REGISTER |
| `LABEL REPLACED` (회색) | 교체된 옛 라벨. 새 번호가 표시됨. 옛 라벨은 폐기 |

분기는 달력 기준입니다 (Q1 1~3월, Q2 4~6월, Q3 7~9월, Q4 10~12월).

## 5. 라벨 교체 · 퇴역 · 수정

- **라벨이 헐겁거나 오염되면 미리 교체**: 옛 라벨을 떼기 전에 스캔 → 판정 화면의 **Replace label** → 새 깡통 라벨 스캔 → 확인. 점검 이력이 새 번호로 따라가고, 옛 번호를 스캔하면 `LABEL REPLACED` 가 뜹니다. 옛 라벨은 찢어 버립니다.
- **라벨이 완전히 떨어진 장비**: 새 라벨로 다시 등록합니다. 옛 번호는 미점검으로 남으므로 분기 말에 **Items → Not inspected** 목록을 보며 실물이 없는 번호를 **Retire** 하고 비고에 `label lost` 라고 적습니다.
- **폐기 장비**: Items → 해당 장비 → **Retire – remove from service**. 기록은 남고 집계에서 빠집니다. 실수면 **Reactivate**.
- **종류·팀 수정**: 장비 상세 → **Edit type / team**.

## 6. 분기 집계 (Export)

**Export → Export inspection report (.xlsx)**: 분기를 고르고 누르면 폰 Downloads 에 두 파일이 저장됩니다.

- `CCI_Inspection_2026-Q4_20261104.xlsx`
  - **Summary**: 종류별 표 + 팀별 표 (Active items / Inspected / Pass / Fail / Not inspected / Completion %) 와 합계
  - **2026-Q4 Status**: 그 분기의 Active 장비 전체 (미점검 포함). Fail → Not inspected → Pass 순
  - **History**: 전체 점검 기록 누적 (superseded 표시 포함)
- `CCI_Backup_20261104.json`: 같은 시점의 전체 백업

**Download master list (.xlsx)**: 장비 목록 (`CCI_MasterList_날짜.xlsx`, Retired 포함).

파일은 USB 케이블이나 폰의 이메일·드라이브로 PC에 옮겨 엑셀에서 엽니다. 엑셀 서식(색)은 없습니다.

## 7. 백업 · 복원

- **Backup now (.json)**: 장비 + 점검 기록 + 설정 전체를 한 파일로 저장합니다. 결과 Export 때도 자동으로 함께 저장됩니다.
- 마지막 백업 후 7일이 지나면 Home에 **Backup recommended** 가 표시됩니다.
- **Restore backup**: 파일을 고르고 건수를 확인하면 폰의 데이터가 그 파일로 **완전히 대체**됩니다. 폰을 바꿀 때 이 방법을 씁니다.
- Settings의 **Delete all items & inspections** 는 `DELETE` 를 입력해야 실행됩니다 (설정은 유지).

## 8. 개발 · 테스트

빌드 도구 없이 동작하는 정적 파일입니다. 라이브러리는 오프라인용으로 `lib/` 에 포함돼 있습니다 (`lib/README.md`).

```
index.html, app.js, styles.css   앱 본체 (단일 페이지)
sw.js                            오프라인 캐시 (배포 때마다 VERSION 을 올릴 것)
manifest.webmanifest, icons/     홈 화면 설치
labels.html                      라벨 인쇄 페이지, labels_0001-0500.pdf
lib/                             jsQR, SheetJS(mini), qrcode-generator
test/                            Playwright e2e 테스트, PDF 생성 스크립트
```

- 로컬 실행: `node test/serve.cjs` → `http://127.0.0.1:8080/`
- 테스트: `node test/e2e.cjs` (Playwright + Chromium, python3 + openpyxl + Pillow 필요). 등록·점검·판정·분기 전환·라벨 교체·Export·백업/복원·오프라인·실제 QR 디코딩까지 56개 항목을 검사하고 `test-output/` 에 화면 캡처와 파일을 남깁니다.
- 라벨 PDF 재생성: `node test/make-pdf.cjs 1 500`
- **테스트용 날짜**: 주소 뒤에 `?today=2027-01-10` 을 붙이면 그 날짜로 분기·판정을 계산합니다 (화면 아래 주황 띠로 표시). 운영 중에는 쓰지 않습니다.
- 데이터는 IndexedDB(`cci-db`)에 JSON 문서 하나로 저장됩니다. 백업 파일이 곧 그 구조입니다.

**새 버전 배포**: 파일을 고친 뒤 `sw.js` 의 `VERSION` 과 `app.js` 의 `APP_VERSION` 을 올려서 main 에 푸시하면 GitHub Pages가 자동으로 반영합니다.

## 9. GitHub Pages 켜기 (관리자, 한 번만)

1. `https://github.com/kimlin70-spec/QR_Color/settings/pages`
2. Build and deployment → Source: **Deploy from a branch**
3. Branch: **main**, 폴더 **/ (root)** → Save
4. 1~2분 뒤 `https://kimlin70-spec.github.io/QR_Color/` 에서 앱이 열립니다.

저장소는 public 이지만 장비 데이터는 폰 안에만 있고 저장소에는 올라가지 않습니다.
