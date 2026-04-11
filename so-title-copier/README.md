# SO Title Copier

ru / ja / es / pt Stack Overflow 질문 페이지에서 아래 형식으로 한 줄을 복사하는 크롬 확장 프로그램입니다.

```text
URL[TAB]원문 제목[TAB]번역된 제목
```

예시:

```text
https://es.stackoverflow.com/questions/623565/traslado-de-columnas-entre-tablas-por-criterios	Traslado de columnas entre tablas por criterios	기준에 따른 테이블 간 열 이동
```

## 설치 방법

1. 크롬에서 `chrome://extensions`로 이동합니다.
2. 오른쪽 위 `개발자 모드`를 켭니다.
3. `압축해제된 확장 프로그램을 로드합니다`를 누릅니다.
4. 이 폴더를 선택합니다.

## 사용 방법

1. `ru`, `ja`, `es`, `pt` Stack Overflow의 질문 페이지를 엽니다.
2. 필요하면 크롬 자동 번역으로 한국어 번역을 켭니다.
3. 확장 프로그램 아이콘을 클릭합니다.
4. 팝업이 열리면 자동으로 다음 형식이 클립보드에 복사됩니다.
   - URL
   - 원문 제목
   - 현재 화면 제목(번역된 한국어 제목)
5. 엑셀에 그대로 붙여넣습니다.

## 참고

- 현재 화면이 번역되지 않았다면 `원문 제목`과 `번역된 제목`이 같을 수 있습니다.
- URL은 `#` 뒤 앵커를 제거한 주소로 저장합니다.
