const watermarkControls = {
  canvas: document.querySelector('#watermarkCanvas'),
  canvasWrap: document.querySelector('#watermarkCanvasWrap'),
  canvasEmpty: document.querySelector('#watermarkCanvasEmpty'),
  canvasDropHint: document.querySelector('#watermarkCanvasDropHint'),
  fileInput: document.querySelector('#watermarkFileInput'),
  uploadDrop: document.querySelector('#watermarkUploadDrop'),
  fileCount: document.querySelector('#watermarkFileCount'),
  fileRow: document.querySelector('#watermarkFileRow'),
  thumbnail: document.querySelector('#watermarkThumbnail'),
  fileName: document.querySelector('#watermarkFileName'),
  fileInfo: document.querySelector('#watermarkFileInfo'),
  canvasTitle: document.querySelector('#watermarkCanvasTitle'),
  zoomReadout: document.querySelector('#watermarkZoomReadout'),
  markCount: document.querySelector('#watermarkMarkCount'),
  candidateCount: document.querySelector('#watermarkCandidateCount'),
  smartScan: document.querySelector('#watermarkSmartScan'),
  smartActions: document.querySelector('#watermarkSmartActions'),
  smartApply: document.querySelector('#watermarkSmartApply'),
  smartClear: document.querySelector('#watermarkSmartClear'),
  brushSize: document.querySelector('#watermarkBrushSize'),
  brushSizeValue: document.querySelector('#watermarkBrushSizeValue'),
  undo: document.querySelector('#watermarkUndo'),
  clear: document.querySelector('#watermarkClear'),
  process: document.querySelector('#watermarkProcess'),
  reset: document.querySelector('#watermarkReset'),
  quality: document.querySelector('#watermarkQuality'),
  qualityValue: document.querySelector('#watermarkQualityValue'),
  qualityControl: document.querySelector('#watermarkQualityControl'),
  export: document.querySelector('#watermarkExport'),
  wideExport: document.querySelector('#watermarkWideExport'),
  exportSpec: document.querySelector('#watermarkExportSpec'),
  exportFormat: document.querySelector('#watermarkExportFormat'),
  themeToggle: document.querySelector('#watermarkThemeToggle'),
  toast: document.querySelector('#watermarkToast'),
};

const watermarkCtx = watermarkControls.canvas.getContext('2d');
const watermarkState = {
  image: null,
  imageUrl: null,
  name: 'image',
  format: 'image/png',
  quality: 0.92,
  tool: 'brush',
  brushSize: 32,
  drawing: null,
  display: { x: 0, y: 0, width: 0, height: 0, scale: 1 },
  sourceCanvas: document.createElement('canvas'),
  resultCanvas: document.createElement('canvas'),
  maskCanvas: document.createElement('canvas'),
  maskHistory: [],
  candidates: [],
  hasResult: false,
};
const sourceCtx = watermarkState.sourceCanvas.getContext('2d', { willReadFrequently: true });
const resultCtx = watermarkState.resultCanvas.getContext('2d', { willReadFrequently: true });
const maskCtx = watermarkState.maskCanvas.getContext('2d', { willReadFrequently: true });
let aiOcrWorkerPromise;

function currentWatermarkTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function updateWatermarkTheme() {
  const isDark = currentWatermarkTheme() === 'dark';
  const label = isDark ? '切换至亮色主题' : '切换至暗色主题';
  watermarkControls.themeToggle.setAttribute('aria-label', label);
  watermarkControls.themeToggle.title = label;
}

function setWatermarkTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('image-cropper-theme', theme); } catch { /* Theme still changes locally. */ }
  updateWatermarkTheme();
}

function clampWatermark(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function resizeWatermarkCanvas() {
  const rect = watermarkControls.canvasWrap.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  watermarkControls.canvas.width = Math.floor(width * dpr);
  watermarkControls.canvas.height = Math.floor(height * dpr);
  watermarkControls.canvas.style.width = `${width}px`;
  watermarkControls.canvas.style.height = `${height}px`;
  watermarkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawWatermarkCanvas();
}

function setWatermarkFile(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    showWatermarkToast('请选择 JPG、PNG 或 WEBP 图片');
    return;
  }
  if (watermarkState.imageUrl) URL.revokeObjectURL(watermarkState.imageUrl);
  watermarkState.imageUrl = URL.createObjectURL(file);
  watermarkState.name = file.name.replace(/\.[^.]+$/, '') || 'watermark-free';
  const image = new Image();
  image.onload = () => {
    watermarkState.image = image;
    [watermarkState.sourceCanvas, watermarkState.resultCanvas, watermarkState.maskCanvas].forEach((canvas) => {
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
    });
    sourceCtx.clearRect(0, 0, image.naturalWidth, image.naturalHeight);
    sourceCtx.drawImage(image, 0, 0);
    resultCtx.clearRect(0, 0, image.naturalWidth, image.naturalHeight);
    resultCtx.drawImage(image, 0, 0);
    maskCtx.clearRect(0, 0, image.naturalWidth, image.naturalHeight);
    watermarkState.maskHistory = [];
    watermarkState.candidates = [];
    watermarkState.hasResult = false;
    watermarkControls.fileCount.textContent = '1 / 1';
    watermarkControls.fileName.textContent = file.name;
    watermarkControls.fileInfo.textContent = `${image.naturalWidth} x ${image.naturalHeight}`;
    watermarkControls.thumbnail.replaceChildren(Object.assign(document.createElement('img'), { src: watermarkState.imageUrl, alt: '' }));
    watermarkControls.fileRow.classList.remove('is-empty');
    watermarkControls.canvasTitle.textContent = file.name;
    watermarkControls.canvasEmpty.classList.add('is-hidden');
    updateWatermarkUi();
    drawWatermarkCanvas();
  };
  image.onerror = () => showWatermarkToast('图片无法读取，请更换文件');
  image.src = watermarkState.imageUrl;
}

function drawWatermarkCanvas() {
  const { canvas } = watermarkControls;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  watermarkCtx.clearRect(0, 0, width, height);
  watermarkCtx.fillStyle = '#30342f';
  watermarkCtx.fillRect(0, 0, width, height);
  if (!watermarkState.image) return;
  const padding = 28;
  const scale = Math.min((width - padding * 2) / watermarkState.image.naturalWidth, (height - padding * 2) / watermarkState.image.naturalHeight, 1);
  const displayWidth = watermarkState.image.naturalWidth * scale;
  const displayHeight = watermarkState.image.naturalHeight * scale;
  const x = (width - displayWidth) / 2;
  const y = (height - displayHeight) / 2;
  watermarkState.display = { x, y, width: displayWidth, height: displayHeight, scale };
  watermarkCtx.imageSmoothingEnabled = true;
  watermarkCtx.imageSmoothingQuality = 'high';
  watermarkCtx.drawImage(watermarkState.resultCanvas, x, y, displayWidth, displayHeight);
  watermarkCtx.save();
  watermarkCtx.globalAlpha = 0.58;
  watermarkCtx.drawImage(watermarkState.maskCanvas, x, y, displayWidth, displayHeight);
  watermarkCtx.restore();
  drawWatermarkCandidates();
  if (watermarkState.drawing?.type === 'box') drawWatermarkBoxPreview(watermarkState.drawing);
}

function drawWatermarkCandidates() {
  if (!watermarkState.candidates.length) return;
  watermarkCtx.save();
  watermarkState.candidates.forEach((candidate, index) => {
    const start = imagePointToCanvas(candidate);
    const width = candidate.w * watermarkState.display.scale;
    const height = candidate.h * watermarkState.display.scale;
    watermarkCtx.fillStyle = candidate.selected ? 'rgba(214, 255, 75, .12)' : 'rgba(11, 14, 10, .34)';
    watermarkCtx.strokeStyle = candidate.selected ? '#d6ff4b' : 'rgba(249, 246, 238, .7)';
    watermarkCtx.lineWidth = 1.4;
    watermarkCtx.setLineDash([5, 4]);
    watermarkCtx.fillRect(start.x, start.y, width, height);
    watermarkCtx.strokeRect(start.x, start.y, width, height);
    watermarkCtx.setLineDash([]);
    watermarkCtx.fillStyle = candidate.selected ? '#d6ff4b' : '#f9f6ee';
    watermarkCtx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    watermarkCtx.fillText(`候选 ${index + 1}`, start.x + 5, Math.max(12, start.y - 5));
  });
  watermarkCtx.restore();
}

function drawWatermarkBoxPreview(drawing) {
  const start = imagePointToCanvas(drawing.start);
  const end = imagePointToCanvas(drawing.current);
  watermarkCtx.save();
  watermarkCtx.fillStyle = 'rgba(255, 154, 75, .14)';
  watermarkCtx.strokeStyle = '#ff9a4b';
  watermarkCtx.lineWidth = 1.5;
  watermarkCtx.setLineDash([5, 4]);
  watermarkCtx.fillRect(start.x, start.y, end.x - start.x, end.y - start.y);
  watermarkCtx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
  watermarkCtx.restore();
}

function imagePointToCanvas(point) {
  return {
    x: watermarkState.display.x + point.x * watermarkState.display.scale,
    y: watermarkState.display.y + point.y * watermarkState.display.scale,
  };
}

function getWatermarkImagePoint(event) {
  const rect = watermarkControls.canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const display = watermarkState.display;
  if (x < display.x || y < display.y || x > display.x + display.width || y > display.y + display.height) return null;
  return {
    x: clampWatermark((x - display.x) / display.scale, 0, watermarkState.image.naturalWidth),
    y: clampWatermark((y - display.y) / display.scale, 0, watermarkState.image.naturalHeight),
  };
}

function saveMaskHistory() {
  if (!watermarkState.image) return;
  const imageData = maskCtx.getImageData(0, 0, watermarkState.maskCanvas.width, watermarkState.maskCanvas.height);
  watermarkState.maskHistory.push(imageData);
  if (watermarkState.maskHistory.length > 12) watermarkState.maskHistory.shift();
}

function paintWatermarkSegment(from, to) {
  const size = watermarkState.brushSize;
  maskCtx.save();
  maskCtx.strokeStyle = 'rgba(255, 89, 72, 1)';
  maskCtx.fillStyle = 'rgba(255, 89, 72, 1)';
  maskCtx.lineCap = 'round';
  maskCtx.lineJoin = 'round';
  maskCtx.lineWidth = size;
  maskCtx.beginPath();
  maskCtx.moveTo(from.x, from.y);
  maskCtx.lineTo(to.x, to.y);
  maskCtx.stroke();
  maskCtx.beginPath();
  maskCtx.arc(to.x, to.y, size / 2, 0, Math.PI * 2);
  maskCtx.fill();
  maskCtx.restore();
}

function finalizeWatermarkBox(drawing) {
  const left = Math.min(drawing.start.x, drawing.current.x);
  const top = Math.min(drawing.start.y, drawing.current.y);
  const width = Math.abs(drawing.current.x - drawing.start.x);
  const height = Math.abs(drawing.current.y - drawing.start.y);
  if (width < 2 || height < 2) return;
  maskCtx.save();
  maskCtx.fillStyle = 'rgba(255, 89, 72, 1)';
  maskCtx.fillRect(left, top, width, height);
  maskCtx.restore();
}

function markedPixelCount() {
  if (!watermarkState.image) return 0;
  const data = maskCtx.getImageData(0, 0, watermarkState.maskCanvas.width, watermarkState.maskCanvas.height).data;
  let count = 0;
  for (let index = 3; index < data.length; index += 4) if (data[index] > 0) count += 1;
  return count;
}

function selectedWatermarkCandidateCount() {
  return watermarkState.candidates.filter((candidate) => candidate.selected).length;
}

function updateWatermarkUi() {
  const hasImage = Boolean(watermarkState.image);
  const marked = markedPixelCount();
  const selectedCandidates = selectedWatermarkCandidateCount();
  watermarkControls.markCount.textContent = marked ? `已标记 ${Math.round(marked / 1000) / 10}k px` : '未标记';
  watermarkControls.candidateCount.textContent = watermarkState.candidates.length ? `${selectedCandidates} / ${watermarkState.candidates.length} 个候选` : '未分析';
  watermarkControls.smartScan.disabled = !hasImage;
  watermarkControls.smartActions.classList.toggle('is-hidden', !watermarkState.candidates.length);
  watermarkControls.smartApply.disabled = !selectedCandidates;
  watermarkControls.undo.disabled = !watermarkState.maskHistory.length;
  watermarkControls.clear.disabled = !marked;
  watermarkControls.process.disabled = !marked;
  watermarkControls.reset.disabled = !watermarkState.hasResult;
  watermarkControls.export.disabled = !hasImage;
  watermarkControls.wideExport.disabled = !hasImage;
  watermarkControls.exportSpec.textContent = hasImage ? `${watermarkState.image.naturalWidth} x ${watermarkState.image.naturalHeight} px` : '等待图片';
  watermarkControls.exportFormat.textContent = watermarkState.format === 'image/png' ? 'PNG' : 'JPG';
  watermarkControls.qualityControl.classList.toggle('is-hidden', watermarkState.format === 'image/png');
}

function candidateAt(point) {
  return watermarkState.candidates.find((candidate) => (
    point.x >= candidate.x && point.x <= candidate.x + candidate.w
    && point.y >= candidate.y && point.y <= candidate.y + candidate.h
  ));
}

function clearWatermarkCandidates() {
  if (!watermarkState.candidates.length) return;
  watermarkState.candidates = [];
  updateWatermarkUi();
  drawWatermarkCanvas();
}

async function getAiOcrWorker() {
  if (!window.Tesseract) throw new Error('OCR 引擎未加载');
  if (!aiOcrWorkerPromise) {
    aiOcrWorkerPromise = window.Tesseract.createWorker('eng', 1, {
      workerPath: './vendor/tesseract/worker.min.js',
      corePath: './vendor/tesseract-core',
      langPath: './vendor/tesseract-lang/4.0.0',
    }).then(async (worker) => {
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
        tessedit_pageseg_mode: '11',
      });
      return worker;
    });
  }
  return aiOcrWorkerPromise;
}

function aiTextCandidate(word) {
  const value = String(word.text || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  return value.includes('AI');
}

async function detectWatermarkCandidates() {
  if (!watermarkState.image) return;
  watermarkControls.smartScan.disabled = true;
  watermarkControls.smartScan.querySelector('span').textContent = '识别中';
  try {
    const worker = await getAiOcrWorker();
    const { data } = await worker.recognize(watermarkState.resultCanvas);
    watermarkState.candidates = (data.words || [])
      .filter(aiTextCandidate)
      .map((word) => {
        const box = word.bbox;
        const padding = Math.max(8, Math.round((box.y1 - box.y0) * 0.35));
        const x = clampWatermark(box.x0 - padding, 0, watermarkState.resultCanvas.width - 1);
        const y = clampWatermark(box.y0 - padding, 0, watermarkState.resultCanvas.height - 1);
        return {
          x,
          y,
          w: clampWatermark(box.x1 - box.x0 + padding * 2, 1, watermarkState.resultCanvas.width - x),
          h: clampWatermark(box.y1 - box.y0 + padding * 2, 1, watermarkState.resultCanvas.height - y),
          selected: true,
        };
      })
      .slice(0, 12);
    showWatermarkToast(watermarkState.candidates.length ? `识别到 ${watermarkState.candidates.length} 处 AI 字样` : '未识别到 AI 字样');
  } catch (error) {
    aiOcrWorkerPromise = undefined;
    watermarkState.candidates = [];
    showWatermarkToast('AI 文字识别未能启动，请刷新页面重试');
  } finally {
    watermarkControls.smartScan.querySelector('span').textContent = '识别 AI 字样';
    updateWatermarkUi();
    drawWatermarkCanvas();
  }
}

function applyWatermarkCandidates() {
  const candidates = watermarkState.candidates.filter((candidate) => candidate.selected);
  if (!candidates.length) return;
  saveMaskHistory();
  maskCtx.save();
  maskCtx.fillStyle = 'rgba(255, 89, 72, 1)';
  candidates.forEach((candidate) => maskCtx.fillRect(candidate.x, candidate.y, candidate.w, candidate.h));
  maskCtx.restore();
  watermarkState.candidates = [];
  updateWatermarkUi();
  drawWatermarkCanvas();
  showWatermarkToast(`已应用 ${candidates.length} 个候选标记`);
}

function chooseWatermarkTool(tool) {
  watermarkState.tool = tool;
  document.querySelectorAll('[data-watermark-tool]').forEach((button) => {
    const selected = button.dataset.watermarkTool === tool;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-checked', String(selected));
  });
  watermarkControls.canvas.style.cursor = watermarkState.image ? (tool === 'brush' ? 'crosshair' : 'cell') : 'default';
}

function clearWatermarkMarks() {
  if (!watermarkState.image) return;
  saveMaskHistory();
  maskCtx.clearRect(0, 0, watermarkState.maskCanvas.width, watermarkState.maskCanvas.height);
  updateWatermarkUi();
  drawWatermarkCanvas();
}

function undoWatermarkMark() {
  const previous = watermarkState.maskHistory.pop();
  if (!previous) return;
  maskCtx.putImageData(previous, 0, 0);
  updateWatermarkUi();
  drawWatermarkCanvas();
}

function resetWatermarkImage() {
  if (!watermarkState.image) return;
  resultCtx.clearRect(0, 0, watermarkState.resultCanvas.width, watermarkState.resultCanvas.height);
  resultCtx.drawImage(watermarkState.image, 0, 0);
  watermarkState.hasResult = false;
  watermarkState.candidates = [];
  updateWatermarkUi();
  drawWatermarkCanvas();
  showWatermarkToast('已恢复原图');
}

function repairMarkedPixels() {
  if (!watermarkState.image || !markedPixelCount()) return;
  const width = watermarkState.resultCanvas.width;
  const height = watermarkState.resultCanvas.height;
  const source = resultCtx.getImageData(0, 0, width, height);
  const mask = maskCtx.getImageData(0, 0, width, height).data;
  const output = new Uint8ClampedArray(source.data);
  const marked = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[(y * width + x) * 4 + 3] > 0) marked.push({ x, y });
    }
  }
  marked.forEach(({ x, y }) => {
    const samples = [];
    for (let radius = 1; radius <= 42 && samples.length < 8; radius += 1) {
      [[x - radius, y], [x + radius, y], [x, y - radius], [x, y + radius]].forEach(([sampleX, sampleY]) => {
        if (sampleX < 0 || sampleY < 0 || sampleX >= width || sampleY >= height) return;
        const sampleIndex = (sampleY * width + sampleX) * 4;
        if (mask[sampleIndex + 3] === 0) samples.push(sampleIndex);
      });
    }
    if (!samples.length) return;
    const index = (y * width + x) * 4;
    [0, 1, 2].forEach((channel) => {
      output[index + channel] = Math.round(samples.reduce((sum, sampleIndex) => sum + source.data[sampleIndex + channel], 0) / samples.length);
    });
  });
  resultCtx.putImageData(new ImageData(output, width, height), 0, 0);
  maskCtx.clearRect(0, 0, width, height);
  watermarkState.maskHistory = [];
  watermarkState.hasResult = true;
  updateWatermarkUi();
  drawWatermarkCanvas();
  showWatermarkToast('已完成局部修复，请检查边缘效果');
}

function downloadWatermarkImage() {
  if (!watermarkState.image) return;
  const extension = watermarkState.format === 'image/png' ? 'png' : 'jpg';
  watermarkState.resultCanvas.toBlob((blob) => {
    if (!blob) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${watermarkState.name}-watermark-free.${extension}`;
    link.click();
    URL.revokeObjectURL(link.href);
    showWatermarkToast('已开始导出图片');
  }, watermarkState.format, watermarkState.quality);
}

function showWatermarkToast(message) {
  clearTimeout(showWatermarkToast.timer);
  watermarkControls.toast.textContent = message;
  watermarkControls.toast.classList.add('is-visible');
  showWatermarkToast.timer = setTimeout(() => watermarkControls.toast.classList.remove('is-visible'), 2500);
}

function isWatermarkFileDrop(event) {
  return Array.from(event.dataTransfer?.types || []).includes('Files');
}

watermarkControls.fileInput.addEventListener('change', (event) => setWatermarkFile(event.target.files?.[0]));
watermarkControls.uploadDrop.addEventListener('dragover', (event) => { event.preventDefault(); watermarkControls.uploadDrop.classList.add('is-dragging'); });
watermarkControls.uploadDrop.addEventListener('dragleave', () => watermarkControls.uploadDrop.classList.remove('is-dragging'));
watermarkControls.uploadDrop.addEventListener('drop', (event) => { event.preventDefault(); watermarkControls.uploadDrop.classList.remove('is-dragging'); setWatermarkFile(event.dataTransfer.files?.[0]); });
watermarkControls.canvasWrap.addEventListener('dragenter', (event) => { if (isWatermarkFileDrop(event)) { event.preventDefault(); watermarkControls.canvasDropHint.classList.add('is-visible'); } });
watermarkControls.canvasWrap.addEventListener('dragover', (event) => { if (isWatermarkFileDrop(event)) event.preventDefault(); });
watermarkControls.canvasWrap.addEventListener('dragleave', () => watermarkControls.canvasDropHint.classList.remove('is-visible'));
watermarkControls.canvasWrap.addEventListener('drop', (event) => { event.preventDefault(); watermarkControls.canvasDropHint.classList.remove('is-visible'); setWatermarkFile(event.dataTransfer.files?.[0]); });

watermarkControls.canvas.addEventListener('pointerdown', (event) => {
  const point = getWatermarkImagePoint(event);
  if (!point) return;
  const candidate = candidateAt(point);
  if (candidate) {
    candidate.selected = !candidate.selected;
    updateWatermarkUi();
    drawWatermarkCanvas();
    return;
  }
  saveMaskHistory();
  watermarkState.drawing = { type: watermarkState.tool, start: point, current: point };
  if (watermarkState.tool === 'brush') paintWatermarkSegment(point, point);
  watermarkControls.canvas.setPointerCapture(event.pointerId);
  drawWatermarkCanvas();
});
watermarkControls.canvas.addEventListener('pointermove', (event) => {
  if (!watermarkState.drawing) return;
  const point = getWatermarkImagePoint(event);
  if (!point) return;
  if (watermarkState.drawing.type === 'brush') paintWatermarkSegment(watermarkState.drawing.current, point);
  watermarkState.drawing.current = point;
  drawWatermarkCanvas();
});
function finishWatermarkDrawing() {
  if (!watermarkState.drawing) return;
  if (watermarkState.drawing.type === 'box') finalizeWatermarkBox(watermarkState.drawing);
  watermarkState.drawing = null;
  updateWatermarkUi();
  drawWatermarkCanvas();
}
watermarkControls.canvas.addEventListener('pointerup', finishWatermarkDrawing);
watermarkControls.canvas.addEventListener('pointercancel', finishWatermarkDrawing);

document.querySelectorAll('[data-watermark-tool]').forEach((button) => button.addEventListener('click', () => chooseWatermarkTool(button.dataset.watermarkTool)));
document.querySelectorAll('[data-watermark-format]').forEach((button) => button.addEventListener('click', () => {
  watermarkState.format = button.dataset.watermarkFormat;
  document.querySelectorAll('[data-watermark-format]').forEach((option) => {
    const selected = option === button;
    option.classList.toggle('is-selected', selected);
    option.setAttribute('aria-checked', String(selected));
  });
  updateWatermarkUi();
}));
watermarkControls.brushSize.addEventListener('input', () => {
  watermarkState.brushSize = Number(watermarkControls.brushSize.value);
  watermarkControls.brushSizeValue.textContent = `${watermarkState.brushSize} px`;
});
watermarkControls.quality.addEventListener('input', () => {
  watermarkState.quality = Number(watermarkControls.quality.value);
  watermarkControls.qualityValue.textContent = `${Math.round(watermarkState.quality * 100)}%`;
});
watermarkControls.undo.addEventListener('click', undoWatermarkMark);
watermarkControls.clear.addEventListener('click', clearWatermarkMarks);
watermarkControls.process.addEventListener('click', repairMarkedPixels);
watermarkControls.reset.addEventListener('click', resetWatermarkImage);
watermarkControls.smartScan.addEventListener('click', detectWatermarkCandidates);
watermarkControls.smartApply.addEventListener('click', applyWatermarkCandidates);
watermarkControls.smartClear.addEventListener('click', clearWatermarkCandidates);
watermarkControls.export.addEventListener('click', downloadWatermarkImage);
watermarkControls.wideExport.addEventListener('click', downloadWatermarkImage);
watermarkControls.themeToggle.addEventListener('click', () => setWatermarkTheme(currentWatermarkTheme() === 'dark' ? 'light' : 'dark'));
window.addEventListener('resize', resizeWatermarkCanvas);

if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 1.7 } });
updateWatermarkTheme();
chooseWatermarkTool('brush');
updateWatermarkUi();
resizeWatermarkCanvas();
