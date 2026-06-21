import { toPng as htmlToImageToPng } from 'https://esm.sh/html-to-image@1.11.11';
import { domToPng as modernScreenshotToPng } from 'https://esm.sh/modern-screenshot@4.6.5';

const captureTarget = document.querySelector('#share-capture-target');
const previewGrid = document.querySelector('#preview-grid');
const statusMessage = document.querySelector('#capture-status');
const previewImage = document.querySelector('#preview-image');
const downloadLink = document.querySelector('#download-link');
const saveHelp = document.querySelector('#save-help');
const librarySelect = document.querySelector('#library-select');
const generateButton = document.querySelector('#generate-button');
const columnButtons = document.querySelectorAll('.column-button');
const libraryButtons = document.querySelectorAll('[data-library]');

const generators = {
  'html-to-image': htmlToImageToPng,
  'modern-screenshot': modernScreenshotToPng,
};

function setStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.dataset.status = type;
}

function setColumns(columns) {
  previewGrid.classList.remove('columns-1', 'columns-2', 'columns-3', 'columns-4');
  previewGrid.classList.add(`columns-${columns}`);

  columnButtons.forEach((button) => {
    const isActive = button.dataset.columns === columns;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });

  setStatus(`${columns}列表示に切り替えました。画像生成は未実行です。`);
}

function resetResult() {
  previewImage.hidden = true;
  previewImage.removeAttribute('src');
  downloadLink.hidden = true;
  downloadLink.removeAttribute('href');
  saveHelp.hidden = true;
}

function buildFileName(libraryName) {
  const dateText = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `sanga-image-generation-${libraryName}-${dateText}.png`;
}

async function generateImage(libraryName) {
  const generator = generators[libraryName];

  if (!captureTarget || !generator) {
    setStatus('画像化対象DOMまたはライブラリが見つかりません。', 'error');
    return;
  }

  resetResult();
  generateButton.disabled = true;
  libraryButtons.forEach((button) => { button.disabled = true; });
  setStatus(`${libraryName} でPNG生成中です。`, 'loading');

  try {
    const dataUrl = await generator(captureTarget, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#fffaf0',
    });

    previewImage.src = dataUrl;
    previewImage.hidden = false;
    downloadLink.href = dataUrl;
    downloadLink.download = buildFileName(libraryName);
    downloadLink.hidden = false;
    saveHelp.hidden = false;
    setStatus(`${libraryName} でPNG生成に成功しました。PCでは「画像を保存」リンク、スマホではプレビュー画像の長押し保存を試してください。`, 'success');
  } catch (error) {
    console.error(`${libraryName} image generation failed`, error);
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`${libraryName} でPNG生成に失敗しました。概要: ${message}`, 'error');
  } finally {
    generateButton.disabled = false;
    libraryButtons.forEach((button) => { button.disabled = false; });
  }
}

columnButtons.forEach((button) => {
  button.addEventListener('click', () => setColumns(button.dataset.columns));
});

generateButton.addEventListener('click', () => generateImage(librarySelect.value));

libraryButtons.forEach((button) => {
  button.addEventListener('click', () => {
    librarySelect.value = button.dataset.library;
    generateImage(button.dataset.library);
  });
});
