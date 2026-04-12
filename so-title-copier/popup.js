const supportedHosts = new Set([
  "ru.stackoverflow.com",
  "ja.stackoverflow.com",
  "es.stackoverflow.com",
  "pt.stackoverflow.com",
]);

const apiSiteMap = {
  "ru.stackoverflow.com": "ru.stackoverflow",
  "ja.stackoverflow.com": "ja.stackoverflow",
  "es.stackoverflow.com": "es.stackoverflow",
  "pt.stackoverflow.com": "pt.stackoverflow",
};

function setStatus(message, isError = false) {
  const statusEl = document.getElementById("status");
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b00020" : "#222";
}

function setOutput(text) {
  const outputEl = document.getElementById("output");
  if (!outputEl) return;
  outputEl.value = text;
}

function decodeHtmlEntities(text) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

function normalizeForCompare(text) {
  return (text || "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isSameMeaningfully(a, b) {
  return normalizeForCompare(a) === normalizeForCompare(b);
}

async function getCurrentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs || !tabs.length) {
    throw new Error("현재 탭을 찾지 못했습니다.");
  }
  return tabs[0];
}

async function getPageInfo(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const url = location.href.split("#")[0];
      const host = location.hostname;
      const path = location.pathname;

      const titleEl =
        document.querySelector("h1 a.question-hyperlink") ||
        document.querySelector("h1 a") ||
        document.querySelector("h1");

      const displayedTitle = titleEl?.textContent?.trim() || "";
      const match = path.match(/^\/questions\/(\d+)/);
      const questionId = match ? match[1] : null;

      return {
        url,
        host,
        path,
        displayedTitle,
        questionId,
      };
    },
  });

  return results?.[0]?.result;
}

async function getOriginalTitleFromApi(questionId, host) {
  const apiSite = apiSiteMap[host];
  if (!apiSite) {
    throw new Error("지원하지 않는 사이트입니다.");
  }

  const apiUrl =
    `https://api.stackexchange.com/2.3/questions/${questionId}` +
    `?site=${encodeURIComponent(apiSite)}`;

  const response = await fetch(apiUrl, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`원문 제목 API 요청 실패: ${response.status}`);
  }

  const data = await response.json();
  const rawTitle = data?.items?.[0]?.title;

  if (!rawTitle) {
    throw new Error("원문 제목을 찾지 못했습니다.");
  }

  return decodeHtmlEntities(rawTitle);
}

async function fallbackTranslateToKorean(text) {
  const url =
    "https://translate.googleapis.com/translate_a/single" +
    `?client=gtx&sl=auto&tl=ko&dt=t&q=${encodeURIComponent(text)}`;

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`재번역 요청 실패: ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error("재번역 응답 형식이 올바르지 않습니다.");
  }

  const translated = data[0]
    .map(part => Array.isArray(part) ? (part[0] || "") : "")
    .join("")
    .trim();

  if (!translated) {
    throw new Error("재번역 결과가 비어 있습니다.");
  }

  return translated;
}

async function resolveKoreanTitle(originalTitle, displayedTitle) {
  if (!isSameMeaningfully(originalTitle, displayedTitle)) {
    return {
      koreanTitle: displayedTitle,
      source: "page",
    };
  }

  setStatus("페이지 제목이 원문과 같아서 재번역 시도 중...");

  try {
    const retried = await fallbackTranslateToKorean(originalTitle);

    if (!isSameMeaningfully(retried, originalTitle)) {
      return {
        koreanTitle: retried,
        source: "fallback",
      };
    }

    return {
      koreanTitle: displayedTitle,
      source: "same_after_retry",
    };
  } catch (error) {
    console.warn("재번역 실패:", error);
    return {
      koreanTitle: displayedTitle,
      source: "retry_failed",
    };
  }
}

async function copyCurrentPageInfo() {
  try {
    setStatus("확인 중...");
    setOutput("");

    const tab = await getCurrentTab();
    const page = await getPageInfo(tab.id);

    if (!page?.host || !supportedHosts.has(page.host)) {
      throw new Error("지원 대상 페이지가 아닙니다.");
    }

    if (!page.path.startsWith("/questions/")) {
      throw new Error("질문 페이지에서만 사용할 수 있습니다.");
    }

    if (!page.questionId) {
      throw new Error("질문 ID를 찾지 못했습니다.");
    }

    if (!page.displayedTitle) {
      throw new Error("현재 화면 제목을 읽지 못했습니다.");
    }

    setStatus("원문 제목 가져오는 중...");
    const originalTitle = await getOriginalTitleFromApi(page.questionId, page.host);

    setStatus("한국어 제목 확인 중...");
    const { koreanTitle, source } = await resolveKoreanTitle(
      originalTitle,
      page.displayedTitle
    );

    const line = `${page.url}\t${originalTitle}\t${koreanTitle}`;
    await navigator.clipboard.writeText(line);

    setOutput(line);

    if (source === "fallback") {
      setStatus("복사 완료 (재번역 사용)");
    } else if (source === "same_after_retry") {
      setStatus("복사 완료 (재번역해도 동일)");
    } else if (source === "retry_failed") {
      setStatus("복사 완료 (재번역 실패, 현재 제목 사용)");
    } else {
      setStatus("복사 완료");
    }
  } catch (error) {
    console.error(error);
    setStatus(error.message || "복사 실패", true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const copyBtn = document.getElementById("copyBtn");
  if (copyBtn) {
    copyBtn.addEventListener("click", copyCurrentPageInfo);
  }
  setStatus("대기 중");
});