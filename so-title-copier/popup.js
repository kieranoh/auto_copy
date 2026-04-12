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

      const translatedTitle = titleEl?.textContent?.trim() || "";
      const match = path.match(/^\/questions\/(\d+)/);
      const questionId = match ? match[1] : null;

      return {
        url,
        host,
        path,
        translatedTitle,
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
    throw new Error(`API 요청 실패: ${response.status}`);
  }

  const data = await response.json();
  const rawTitle = data?.items?.[0]?.title;

  if (!rawTitle) {
    throw new Error("원문 제목을 찾지 못했습니다.");
  }

  return decodeHtmlEntities(rawTitle);
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

    if (!page.translatedTitle) {
      throw new Error("현재 화면 제목을 읽지 못했습니다.");
    }

    setStatus("원문 제목 가져오는 중...");

    const originalTitle = await getOriginalTitleFromApi(page.questionId, page.host);
    const line = `${page.url}\t${originalTitle}\t${page.translatedTitle}`;

    await navigator.clipboard.writeText(line);

    setOutput(line);
    setStatus("복사 완료");
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