const copyBtn = document.getElementById('copyBtn');
const statusEl = document.getElementById('status');
const outputEl = document.getElementById('output');

const SUPPORTED_HOSTS = new Set([
  'ru.stackoverflow.com',
  'ja.stackoverflow.com',
  'es.stackoverflow.com',
  'pt.stackoverflow.com'
]);

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.background = isError ? '#fdeaea' : '#f4f4f4';
  statusEl.style.color = isError ? '#9f1d1d' : '#222222';
}

function normalizeTitle(text) {
  return (text || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*Stack Overflow.*$/i, '')
    .trim();
}

async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

async function extractQuestionInfo() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.id || !tab.url) {
    throw new Error('현재 탭 정보를 읽지 못했습니다.');
  }

  const url = new URL(tab.url);

  if (!SUPPORTED_HOSTS.has(url.hostname) || !url.pathname.startsWith('/questions/')) {
    throw new Error('지원 대상이 아닙니다. ru / ja / es / pt Stack Overflow 질문 페이지에서 실행해 주세요.');
  }

  const injectionResults = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: async () => {
      function normalizeTitleInner(text) {
        return (text || '')
          .replace(/\s+/g, ' ')
          .replace(/\s*-\s*Stack Overflow.*$/i, '')
          .trim();
      }

      function getDisplayedTitle() {
        const candidates = [
          document.querySelector('h1 a.question-hyperlink'),
          document.querySelector('h1[itemprop="name"] a'),
          document.querySelector('h1 a'),
          document.querySelector('h1')
        ];

        for (const el of candidates) {
          const text = normalizeTitleInner(el?.textContent || '');
          if (text) return text;
        }

        return normalizeTitleInner(document.title);
      }

      async function getOriginalTitle(pageUrl) {
        const response = await fetch(pageUrl, {
          method: 'GET',
          credentials: 'omit',
          cache: 'no-store'
        });

        if (!response.ok) {
          throw new Error(`원문 페이지 요청 실패: ${response.status}`);
        }

        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');

        const candidates = [
          doc.querySelector('h1 a.question-hyperlink'),
          doc.querySelector('h1[itemprop="name"] a'),
          doc.querySelector('h1 a'),
          doc.querySelector('h1')
        ];

        for (const el of candidates) {
          const text = normalizeTitleInner(el?.textContent || '');
          if (text) return text;
        }

        return normalizeTitleInner(doc.title);
      }

      const cleanUrl = location.href.split('#')[0];
      const translatedTitle = getDisplayedTitle();
      const originalTitle = await getOriginalTitle(cleanUrl);

      return {
        url: cleanUrl,
        originalTitle,
        translatedTitle
      };
    }
  });

  const result = injectionResults?.[0]?.result;

  if (!result || !result.url) {
    throw new Error('페이지에서 제목을 추출하지 못했습니다.');
  }

  return result;
}

async function runCopy() {
  copyBtn.disabled = true;
  setStatus('추출 중입니다...');
  outputEl.value = '';

  try {
    const { url, originalTitle, translatedTitle } = await extractQuestionInfo();
    const line = `${url}\t${normalizeTitle(originalTitle)}\t${normalizeTitle(translatedTitle)}`;

    await copyToClipboard(line);
    outputEl.value = line;
    setStatus('복사 완료. 엑셀에 바로 붙여넣으시면 됩니다.');
  } catch (error) {
    console.error(error);
    setStatus(error.message || '알 수 없는 오류가 발생했습니다.', true);
  } finally {
    copyBtn.disabled = false;
  }
}

copyBtn.addEventListener('click', runCopy);
window.addEventListener('DOMContentLoaded', runCopy);
