document.addEventListener("DOMContentLoaded", () => {
  const images = document.querySelectorAll(".image-grid img");

  // 現在のタイムスタンプを取得
  const timestamp = new Date().getTime();

  // CSSファイルのキャッシュ回避
  const stylesheet = document.querySelector('link[rel="stylesheet"]');
  if (stylesheet) {
    const originalHref = stylesheet.getAttribute('href').split('?')[0];
    stylesheet.setAttribute('href', `${originalHref}?t=${timestamp}`);
  }

  // JSファイルのキャッシュ回避
  const scripts = document.querySelectorAll('script[src]');
  scripts.forEach((script) => {
    const originalSrc = script.getAttribute('src').split('?')[0];
    script.setAttribute('src', `${originalSrc}?t=${timestamp}`);
  });

  // 画像のキャッシュ回避
  images.forEach((img) => {
    const originalSrc = img.getAttribute('src').split('?')[0];
    img.setAttribute('src', `${originalSrc}?t=${timestamp}`);
  });

  // Cookie操作用関数
  function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/`;
  }

  function getCookie(name) {
    const cookies = document.cookie.split("; ");
    for (let i = 0; i < cookies.length; i++) {
      const [key, value] = cookies[i].split("=");
      if (key === name) {
        return value;
      }
    }
    return null;
  }

  // 画像のクリック状態を管理
  images.forEach((img, index) => {
    // 画像のクリック状態をCookieから取得
    let clickCount = parseInt(getCookie(`image_${index}`)) || 0;

    // 初期状態を適用
    updateBorderColor(img, clickCount);

    // クリックイベント
    img.addEventListener("click", () => {
      clickCount = (clickCount + 1) % 3; // クリック回数を3回でリセット
      setCookie(`image_${index}`, clickCount, 7); // 状態を7日間保存
      updateBorderColor(img, clickCount);
    });
  });

  // 枠線の色を更新する関数
  function updateBorderColor(img, clickCount) {
    switch (clickCount) {
      case 1:
        img.style.borderColor = "#EC1834"; // 初回クリック時の枠線色
        break;
      case 2:
        img.style.borderColor = "#ff69b4"; // 2回目クリック時の枠線色
        break;
      default:
        img.style.borderColor = "#ffffff"; // デフォルトの枠線色
        break;
    }
  }
});
