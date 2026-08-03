const canvas = document.querySelector('#cropCanvas');
const canvasWrap = document.querySelector('#canvasWrap');
const ctx = canvas.getContext('2d');
const fileInput = document.querySelector('#fileInput');
const uploadDrop = document.querySelector('#uploadDrop');
const canvasEmpty = document.querySelector('#canvasEmpty');
const canvasDropHint = document.querySelector('#canvasDropHint');
const toast = document.querySelector('#toast');

const controls = {
  themeToggle: document.querySelector('#themeToggle'),
  export: document.querySelector('#exportButton'),
  wideExport: document.querySelector('#wideExportButton'),
  zoom: document.querySelector('#zoomRange'),
  zoomValue: document.querySelector('#zoomValue'),
  zoomReadout: document.querySelector('#zoomReadout'),
  rotationReadout: document.querySelector('#rotationReadout'),
  rotateLeft: document.querySelector('#rotateLeft'),
  rotateRight: document.querySelector('#rotateRight'),
  flipHorizontal: document.querySelector('#flipHorizontal'),
  flipVertical: document.querySelector('#flipVertical'),
  outputWidth: document.querySelector('#outputWidth'),
  outputHeight: document.querySelector('#outputHeight'),
  matchRatio: document.querySelector('#matchRatio'),
  quality: document.querySelector('#qualityRange'),
  qualityValue: document.querySelector('#qualityValue'),
  qualityControl: document.querySelector('#qualityControl'),
  exportSpec: document.querySelector('#exportSpec'),
  exportFormat: document.querySelector('#exportFormat'),
  headerExportLabel: document.querySelector('#headerExportLabel'),
  wideExportLabel: document.querySelector('#wideExportLabel'),
  modeNote: document.querySelector('#modeNote'),
  canvasTitle: document.querySelector('#canvasTitle'),
  fileCount: document.querySelector('#fileCount'),
  fileRow: document.querySelector('#fileRow'),
  fileName: document.querySelector('#fileName'),
  fileInfo: document.querySelector('#fileInfo'),
  gridControls: document.querySelector('#gridControls'),
  gridEditMode: document.querySelector('#gridEditMode'),
  gridSelectMode: document.querySelector('#gridSelectMode'),
  addVerticalLine: document.querySelector('#addVerticalLine'),
  addHorizontalLine: document.querySelector('#addHorizontalLine'),
  resetGridLines: document.querySelector('#resetGridLines'),
  smartControls: document.querySelector('#smartControls'),
  analyzeSmart: document.querySelector('#analyzeSmart'),
  smartCount: document.querySelector('#smartCount'),
  smartCandidates: document.querySelector('#smartCandidates'),
  smartExportMode: document.querySelector('#smartExportMode'),
};

const state = {
  image: null,
  imageUrl: '',
  imageName: '',
  imageType: '',
  ratio: 'source',
  crop: { x: 0, y: 0, w: 0, h: 0 },
  view: { scale: 1, pan: { x: 0, y: 0 } },
  zoom: 1,
  rotation: 0,
  flipX: 1,
  flipY: 1,
  imageOffset: { x: 0, y: 0 },
  format: 'image/png',
  mode: 'single',
  quality: 0.92,
  interaction: null,
  grid: {
    vertical: [1 / 3, 2 / 3],
    horizontal: [1 / 3, 2 / 3],
    tool: 'edit',
    selectedCells: new Set(),
  },
  hoverLine: null,
  selectedGridLine: null,
  hoverGridCell: null,
  keyboard: { space: false },
  smart: { candidates: [], activeId: null, exportMode: 'bounds' },
};

const MIN_CROP_SIZE = 96;
const CROP_PADDING = 28;
const GRID_LINE_HIT_AREA = 10;
const GRID_LINE_MIN_GAP = 0.000001;
const SMART_MIN_VARIANCE = 72;
const SMART_MAX_SEAM_DIFFERENCE = 18;
const SMART_DIVIDER_MAX_RELATIVE_SIZE = 0.38;
const SMART_DIVIDER_MAX_SOURCE_RATIO = 0.07;
const SMART_MIN_CANDIDATE_AREA = 0.012;
const SMART_MIN_CANDIDATE_SIDE = 0.08;
const SMART_MIN_SEPARATOR_CONTRAST = 8;
// Analysis uses a 900px canvas, so this retains 2-4px gutters from source collages.
const SMART_MIN_SEPARATOR_BAND_RATIO = 0.003;
const SMART_MIN_CONTENT_SEGMENT_RATIO = 0.08;
const SMART_TRIM_BACKGROUND_RATIO = 0.82;
const SMART_TRIM_CONTENT_BACKGROUND_RATIO = 0.58;
const SMART_TRIM_MAX_RELATIVE_SIZE = 0.6;
const SMART_TRIM_CONTENT_STREAK = 4;
const SMART_TRIM_MIN_LINE_VARIANCE = 140;
const SMART_BORDER_CONSENSUS_MIN_TRIM_RATIO = 0.12;
const SMART_COMPONENT_MIN_AREA = 0.006;
const SMART_COMPONENT_MIN_SIDE = 0.055;
const SMART_HANDLE_SIZE = 9;
const VIEW_MIN_SCALE = 0.3;
const VIEW_MAX_SCALE = 4;
const THEME_STORAGE_KEY = 'image-cropper-theme';

function round(value) {
  return Math.round(value);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function canvasCenter() {
  return { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 };
}

function applyViewTransform(targetContext) {
  const center = canvasCenter();
  targetContext.translate(center.x + state.view.pan.x, center.y + state.view.pan.y);
  targetContext.scale(state.view.scale, state.view.scale);
  targetContext.translate(-center.x, -center.y);
}

function screenToWorld(point) {
  const center = canvasCenter();
  return {
    x: (point.x - center.x - state.view.pan.x) / state.view.scale + center.x,
    y: (point.y - center.y - state.view.pan.y) / state.view.scale + center.y,
  };
}

function worldToScreen(point) {
  const center = canvasCenter();
  return {
    x: (point.x - center.x) * state.view.scale + center.x + state.view.pan.x,
    y: (point.y - center.y) * state.view.scale + center.y + state.view.pan.y,
  };
}

function zoomViewAt(point, deltaY) {
  const worldPoint = screenToWorld(point);
  const nextScale = clamp(state.view.scale * Math.exp(-deltaY * 0.0012), VIEW_MIN_SCALE, VIEW_MAX_SCALE);
  const center = canvasCenter();
  state.view.scale = nextScale;
  state.view.pan.x = point.x - center.x - (worldPoint.x - center.x) * nextScale;
  state.view.pan.y = point.y - center.y - (worldPoint.y - center.y) * nextScale;
}

function currentTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function updateThemeToggle() {
  const isDark = currentTheme() === 'dark';
  const label = isDark ? '切换至亮色主题' : '切换至暗色主题';
  controls.themeToggle.setAttribute('aria-label', label);
  controls.themeToggle.setAttribute('aria-pressed', String(isDark));
  controls.themeToggle.title = label;
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Theme switching still works when browser storage is unavailable.
  }
  updateThemeToggle();
}

function gridTileCount() {
  const width = Math.max(1, Number(controls.outputWidth.value) || 1600);
  const height = Math.max(1, Number(controls.outputHeight.value) || 1600);
  return (gridExportEdges(width, state.grid.vertical).length - 1) * (gridExportEdges(height, state.grid.horizontal).length - 1);
}

function gridCellKey(row, column) {
  return `${row}:${column}`;
}

function selectedGridCells() {
  return Array.from(state.grid.selectedCells)
    .map((key) => key.split(':').map(Number))
    .filter(([row, column]) => row >= 0 && column >= 0 && row <= state.grid.horizontal.length && column <= state.grid.vertical.length)
    .map(([row, column]) => ({ row, column }))
    .sort((first, second) => first.row - second.row || first.column - second.column);
}

function selectedGridCellCount() {
  return selectedGridCells().length;
}

function clearGridCellSelection() {
  state.grid.selectedCells.clear();
  state.hoverGridCell = null;
}

function clearGridLineSelection() {
  state.selectedGridLine = null;
  state.hoverLine = null;
}

function clearGridSelectionForTopologyChange() {
  clearGridCellSelection();
  clearGridLineSelection();
}

function gridCellBounds(row, column) {
  const left = column === 0 ? 0 : state.grid.vertical[column - 1];
  const right = column === state.grid.vertical.length ? 1 : state.grid.vertical[column];
  const top = row === 0 ? 0 : state.grid.horizontal[row - 1];
  const bottom = row === state.grid.horizontal.length ? 1 : state.grid.horizontal[row];
  return { left, top, right, bottom };
}

function selectedSmartCandidateCount() {
  return state.smart.candidates.filter((candidate) => candidate.selected).length;
}

function clearSmartAnalysis() {
  if (!state.smart.candidates.length && !state.smart.activeId) return;
  state.smart.candidates = [];
  state.smart.activeId = null;
}

function resetGridLines() {
  state.grid.vertical = [1 / 3, 2 / 3];
  state.grid.horizontal = [1 / 3, 2 / 3];
  state.grid.tool = 'edit';
  clearGridSelectionForTopologyChange();
  clearSmartAnalysis();
  updateUi();
  draw();
}

function addGridLine(orientation) {
  const lines = state.grid[orientation];
  const boundaries = [0, ...lines, 1];
  let widestGap = 0;
  let insertAt = 0;
  boundaries.slice(0, -1).forEach((start, index) => {
    const gap = boundaries[index + 1] - start;
    if (gap > widestGap) {
      widestGap = gap;
      insertAt = index;
    }
  });
  if (widestGap < GRID_LINE_MIN_GAP * 2) {
    showToast('当前分割线间距过小，无法继续添加');
    return;
  }
  const position = (boundaries[insertAt] + boundaries[insertAt + 1]) / 2;
  lines.push(position);
  lines.sort((a, b) => a - b);
  clearGridCellSelection();
  state.grid.tool = 'edit';
  state.selectedGridLine = { orientation, index: lines.indexOf(position) };
  clearSmartAnalysis();
  updateUi();
  draw();
}

function ratioValue() {
  if (state.ratio === 'free') return null;
  if (state.ratio === 'source') {
    return state.image ? state.image.naturalWidth / state.image.naturalHeight : 1;
  }
  return Number(state.ratio);
}

function updateRatioOptions() {
  document.querySelectorAll('.ratio-option').forEach((option) => {
    const selected = option.dataset.ratio === String(state.ratio);
    option.classList.toggle('is-selected', selected);
    option.setAttribute('aria-checked', String(selected));
  });
}

function currentCropRatio() {
  return state.crop.w / state.crop.h;
}

function resizeCanvas() {
  const rect = canvasWrap.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!state.crop.w || !state.crop.h) {
    setCropForRatio();
  } else {
    clampCrop();
  }
  draw();
}

function setCropForRatio(preserveCenter = false) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  const maxWidth = Math.max(MIN_CROP_SIZE, width - CROP_PADDING * 2);
  const maxHeight = Math.max(MIN_CROP_SIZE, height - CROP_PADDING * 2);
  const ratio = ratioValue();
  let cropWidth;
  let cropHeight;
  if (ratio) {
    cropWidth = maxWidth;
    cropHeight = cropWidth / ratio;
    if (cropHeight > maxHeight) {
      cropHeight = maxHeight;
      cropWidth = cropHeight * ratio;
    }
  } else {
    cropWidth = maxWidth * 0.78;
    cropHeight = maxHeight * 0.78;
  }
  const centerX = preserveCenter && state.crop.w ? state.crop.x + state.crop.w / 2 : width / 2;
  const centerY = preserveCenter && state.crop.h ? state.crop.y + state.crop.h / 2 : height / 2;
  state.crop = { x: centerX - cropWidth / 2, y: centerY - cropHeight / 2, w: cropWidth, h: cropHeight };
  clampCrop();
  if (state.image) {
    clampImagePosition();
    syncOutputSize();
  }
}

function clampCrop() {
  const maxX = canvas.clientWidth - CROP_PADDING;
  const maxY = canvas.clientHeight - CROP_PADDING;
  state.crop.w = clamp(state.crop.w, MIN_CROP_SIZE, Math.max(MIN_CROP_SIZE, canvas.clientWidth - CROP_PADDING * 2));
  state.crop.h = clamp(state.crop.h, MIN_CROP_SIZE, Math.max(MIN_CROP_SIZE, canvas.clientHeight - CROP_PADDING * 2));
  state.crop.x = clamp(state.crop.x, CROP_PADDING, Math.max(CROP_PADDING, maxX - state.crop.w));
  state.crop.y = clamp(state.crop.y, CROP_PADDING, Math.max(CROP_PADDING, maxY - state.crop.h));
}

function imageScale() {
  if (!state.image) return 1;
  const radians = (state.rotation * Math.PI) / 180;
  const rotatedWidth = Math.abs(state.image.naturalWidth * Math.cos(radians)) + Math.abs(state.image.naturalHeight * Math.sin(radians));
  const rotatedHeight = Math.abs(state.image.naturalWidth * Math.sin(radians)) + Math.abs(state.image.naturalHeight * Math.cos(radians));
  return Math.max(state.crop.w / rotatedWidth, state.crop.h / rotatedHeight) * state.zoom;
}

function clampImagePosition() {
  if (!state.image) return;
  const scale = imageScale();
  const radians = (state.rotation * Math.PI) / 180;
  const renderedWidth = state.image.naturalWidth * scale;
  const renderedHeight = state.image.naturalHeight * scale;
  const boundingWidth = Math.abs(renderedWidth * Math.cos(radians)) + Math.abs(renderedHeight * Math.sin(radians));
  const boundingHeight = Math.abs(renderedWidth * Math.sin(radians)) + Math.abs(renderedHeight * Math.cos(radians));
  const maxOffsetX = Math.max(0, (boundingWidth - state.crop.w) / 2);
  const maxOffsetY = Math.max(0, (boundingHeight - state.crop.h) / 2);
  state.imageOffset.x = clamp(state.imageOffset.x, -maxOffsetX, maxOffsetX);
  state.imageOffset.y = clamp(state.imageOffset.y, -maxOffsetY, maxOffsetY);
}

function drawImageWithTransform(targetContext, scaleFactor = 1, translateToCropCenter = false) {
  if (!state.image) return;
  const imageScaleValue = imageScale() * scaleFactor;
  const cropCenterX = (state.crop.x + state.crop.w / 2) * scaleFactor;
  const cropCenterY = (state.crop.y + state.crop.h / 2) * scaleFactor;
  const offsetX = state.imageOffset.x * scaleFactor;
  const offsetY = state.imageOffset.y * scaleFactor;
  targetContext.save();
  if (translateToCropCenter) {
    targetContext.translate(0, 0);
  } else {
    targetContext.translate(cropCenterX, cropCenterY);
  }
  targetContext.translate(offsetX, offsetY);
  targetContext.rotate((state.rotation * Math.PI) / 180);
  targetContext.scale(state.flipX, state.flipY);
  targetContext.drawImage(
    state.image,
    (-state.image.naturalWidth * imageScaleValue) / 2,
    (-state.image.naturalHeight * imageScaleValue) / 2,
    state.image.naturalWidth * imageScaleValue,
    state.image.naturalHeight * imageScaleValue,
  );
  targetContext.restore();
}

function draw() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#e9e3d6';
  ctx.fillRect(0, 0, width, height);

  if (!state.image) {
    drawEmptyTexture(width, height);
    return;
  }

  ctx.save();
  applyViewTransform(ctx);
  drawImageWithTransform(ctx);
  drawMask(width, height);
  if (state.mode !== 'smart') drawCropBoundary();
  if (state.mode === 'smart') drawSmartCandidates();
  ctx.restore();
}

function drawEmptyTexture(width, height) {
  const unit = 32;
  ctx.fillStyle = '#e4ddcf';
  for (let y = 0; y < height; y += unit) {
    for (let x = 0; x < width; x += unit) {
      if ((x / unit + y / unit) % 2 === 0) ctx.fillRect(x, y, unit, unit);
    }
  }
  ctx.fillStyle = 'rgba(34, 38, 34, .14)';
  ctx.fillRect(0, 0, width, height);
}

function drawMask(width, height) {
  ctx.save();
  ctx.fillStyle = 'rgba(14, 16, 14, .58)';
  ctx.fillRect(0, 0, width, state.crop.y);
  ctx.fillRect(0, state.crop.y + state.crop.h, width, height - state.crop.y - state.crop.h);
  ctx.fillRect(0, state.crop.y, state.crop.x, state.crop.h);
  ctx.fillRect(state.crop.x + state.crop.w, state.crop.y, width - state.crop.x - state.crop.w, state.crop.h);
  ctx.restore();
}

function drawCropBoundary() {
  const { x, y, w, h } = state.crop;
  ctx.save();
  ctx.strokeStyle = '#f9f6ee';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x, y, w, h);
  const usesGrid = state.mode === 'nine' || state.mode === 'smart';
  const verticalLines = usesGrid ? state.grid.vertical : [1 / 3, 2 / 3];
  const horizontalLines = usesGrid ? state.grid.horizontal : [1 / 3, 2 / 3];
  if (state.mode === 'nine') drawGridSelections();
  verticalLines.forEach((position, index) => drawGridLine('vertical', index, x + w * position, y, y + h));
  horizontalLines.forEach((position, index) => drawGridLine('horizontal', index, y + h * position, x, x + w));
  const handles = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  ctx.fillStyle = '#f9f6ee';
  handles.forEach(([handleX, handleY]) => ctx.fillRect(handleX - 4, handleY - 4, 8, 8));
  ctx.restore();
}

function drawGridLine(orientation, index, position, start, end) {
  const isGridMode = state.mode === 'nine';
  const isInteractive = isGridMode && state.grid.tool === 'edit';
  const isActive = state.interaction?.type === 'move-grid-line'
    && state.interaction.orientation === orientation
    && state.interaction.index === index;
  const isHovered = state.hoverLine?.orientation === orientation && state.hoverLine?.index === index;
  const isSelected = state.selectedGridLine?.orientation === orientation && state.selectedGridLine?.index === index;
  const lineColor = isActive || isSelected ? '#ff9a4b' : '#d6ff4b';

  ctx.save();
  ctx.beginPath();
  if (orientation === 'vertical') {
    ctx.moveTo(position, start);
    ctx.lineTo(position, end);
  } else {
    ctx.moveTo(start, position);
    ctx.lineTo(end, position);
  }
  ctx.strokeStyle = isGridMode ? 'rgba(5, 8, 4, .8)' : 'rgba(249, 246, 238, .4)';
  ctx.lineWidth = isGridMode ? 1.7 : 1;
  ctx.stroke();

  ctx.beginPath();
  if (orientation === 'vertical') {
    ctx.moveTo(position, start);
    ctx.lineTo(position, end);
  } else {
    ctx.moveTo(start, position);
    ctx.lineTo(end, position);
  }
  ctx.strokeStyle = isGridMode ? lineColor : 'rgba(249, 246, 238, .48)';
  ctx.lineWidth = isGridMode ? (isActive || isSelected || isHovered ? 1.55 : 0.9) : 1;
  ctx.stroke();

  if (isInteractive) {
    const handleSize = isActive || isHovered ? 8 : 6;
    ctx.fillStyle = lineColor;
    ctx.strokeStyle = '#10150d';
    ctx.lineWidth = 1;
    if (orientation === 'vertical') {
      const handleY = (start + end) / 2;
      ctx.fillRect(position - handleSize / 2, handleY - 7, handleSize, 14);
      ctx.strokeRect(position - handleSize / 2, handleY - 7, handleSize, 14);
    } else {
      const handleX = (start + end) / 2;
      ctx.fillRect(handleX - 7, position - handleSize / 2, 14, handleSize);
      ctx.strokeRect(handleX - 7, position - handleSize / 2, 14, handleSize);
    }
  }
  ctx.restore();
}

function drawGridSelections() {
  const selected = state.grid.selectedCells;
  const hovered = state.hoverGridCell;
  if (!selected.size && !hovered) return;

  ctx.save();
  for (let row = 0; row <= state.grid.horizontal.length; row += 1) {
    for (let column = 0; column <= state.grid.vertical.length; column += 1) {
      const key = gridCellKey(row, column);
      const isSelected = selected.has(key);
      const isHovered = hovered?.row === row && hovered?.column === column;
      if (!isSelected && !isHovered) continue;
      const { left, top, right, bottom } = gridCellBounds(row, column);
      const x = state.crop.x + left * state.crop.w;
      const y = state.crop.y + top * state.crop.h;
      const width = (right - left) * state.crop.w;
      const height = (bottom - top) * state.crop.h;
      ctx.fillStyle = isSelected ? 'rgba(255, 154, 75, .16)' : 'rgba(214, 255, 75, .08)';
      ctx.fillRect(x, y, width, height);
      ctx.strokeStyle = isSelected ? '#ff9a4b' : 'rgba(214, 255, 75, .72)';
      ctx.lineWidth = isSelected ? 1.6 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, width - 1), Math.max(0, height - 1));
    }
  }
  ctx.restore();
}

function candidateBounds(candidate) {
  return candidate.bounds || candidate;
}

function candidateContour(candidate) {
  return candidate.contour?.length
    ? candidate.contour
    : [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
}

function candidateCanvasPoints(candidate) {
  const bounds = candidateBounds(candidate);
  return candidateContour(candidate).map((point) => ({
    x: state.crop.x + (bounds.x + point.x * bounds.w) * state.crop.w,
    y: state.crop.y + (bounds.y + point.y * bounds.h) * state.crop.h,
  }));
}

function candidateCanvasBounds(candidate) {
  const bounds = candidateBounds(candidate);
  return {
    x: state.crop.x + bounds.x * state.crop.w,
    y: state.crop.y + bounds.y * state.crop.h,
    w: bounds.w * state.crop.w,
    h: bounds.h * state.crop.h,
  };
}

function drawPath(points) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.closePath();
}

function smartHandlePositions(candidate) {
  const { x, y, w, h } = candidateCanvasBounds(candidate);
  return {
    nw: { x, y }, n: { x: x + w / 2, y }, ne: { x: x + w, y }, e: { x: x + w, y: y + h / 2 },
    se: { x: x + w, y: y + h }, s: { x: x + w / 2, y: y + h }, sw: { x, y: y + h }, w: { x, y: y + h / 2 },
  };
}

function drawSmartCandidates() {
  ctx.save();
  state.smart.candidates.forEach((candidate) => {
    const points = candidateCanvasPoints(candidate);
    const isActive = candidate.id === state.smart.activeId;
    drawPath(points);
    ctx.fillStyle = candidate.selected ? 'rgba(184, 237, 91, .08)' : 'rgba(11, 14, 10, .3)';
    ctx.fill();
    ctx.strokeStyle = isActive ? '#ff9a4b' : (candidate.selected ? '#d6ff4b' : 'rgba(249, 246, 238, .56)');
    ctx.lineWidth = isActive ? 1.8 / state.view.scale : (candidate.selected ? 1.5 / state.view.scale : 1 / state.view.scale);
    ctx.stroke();
    if (!isActive) return;
    const bounds = candidateCanvasBounds(candidate);
    ctx.setLineDash([5 / state.view.scale, 4 / state.view.scale]);
    ctx.strokeStyle = '#ffbd87';
    ctx.lineWidth = 1 / state.view.scale;
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.setLineDash([]);
    const size = SMART_HANDLE_SIZE / state.view.scale;
    ctx.fillStyle = '#ff9a4b';
    ctx.strokeStyle = '#11160e';
    ctx.lineWidth = 1 / state.view.scale;
    Object.values(smartHandlePositions(candidate)).forEach((handle) => {
      ctx.fillRect(handle.x - size / 2, handle.y - size / 2, size, size);
      ctx.strokeRect(handle.x - size / 2, handle.y - size / 2, size, size);
    });
  });
  ctx.restore();
}

function getScreenPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function getPoint(event) {
  return screenToWorld(getScreenPoint(event));
}

function cornerAt(point) {
  const { x, y, w, h } = state.crop;
  const corners = { nw: [x, y], ne: [x + w, y], se: [x + w, y + h], sw: [x, y + h] };
  return Object.entries(corners).find(([, corner]) => Math.hypot(point.x - corner[0], point.y - corner[1]) < 16 / state.view.scale)?.[0] || null;
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const first = polygon[index];
    const second = polygon[previous];
    const crosses = (first.y > point.y) !== (second.y > point.y)
      && point.x < ((second.x - first.x) * (point.y - first.y)) / (second.y - first.y) + first.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function activeSmartCandidate() {
  return state.smart.candidates.find((candidate) => candidate.id === state.smart.activeId) || null;
}

function smartCandidateAt(point) {
  return [...state.smart.candidates].reverse().find((candidate) => pointInPolygon(point, candidateCanvasPoints(candidate))) || null;
}

function smartHandleAt(point) {
  const candidate = activeSmartCandidate();
  if (!candidate) return null;
  const hitArea = Math.max(7, SMART_HANDLE_SIZE) / state.view.scale;
  return Object.entries(smartHandlePositions(candidate))
    .find(([, handle]) => Math.abs(point.x - handle.x) <= hitArea && Math.abs(point.y - handle.y) <= hitArea)?.[0] || null;
}

function gridLineAt(point) {
  if (state.mode !== 'nine' || state.grid.tool !== 'edit' || !pointInCrop(point)) return null;
  const vertical = state.grid.vertical
    .map((position, index) => ({ orientation: 'vertical', index, distance: Math.abs(point.x - (state.crop.x + state.crop.w * position)) }))
    .filter((line) => line.distance <= GRID_LINE_HIT_AREA / state.view.scale);
  const horizontal = state.grid.horizontal
    .map((position, index) => ({ orientation: 'horizontal', index, distance: Math.abs(point.y - (state.crop.y + state.crop.h * position)) }))
    .filter((line) => line.distance <= GRID_LINE_HIT_AREA / state.view.scale);
  return [...vertical, ...horizontal].sort((a, b) => a.distance - b.distance)[0] || null;
}

function gridCellAt(point) {
  if (state.mode !== 'nine' || state.grid.tool !== 'select' || !pointInCrop(point)) return null;
  const relativeX = clamp((point.x - state.crop.x) / state.crop.w, 0, 0.999999999);
  const relativeY = clamp((point.y - state.crop.y) / state.crop.h, 0, 0.999999999);
  const verticalEdges = [0, ...state.grid.vertical, 1];
  const horizontalEdges = [0, ...state.grid.horizontal, 1];
  const column = verticalEdges.findIndex((edge, index) => relativeX >= edge && relativeX < verticalEdges[index + 1]);
  const row = horizontalEdges.findIndex((edge, index) => relativeY >= edge && relativeY < horizontalEdges[index + 1]);
  return row < 0 || column < 0 ? null : { row, column };
}

function chooseGridTool(tool) {
  state.grid.tool = tool;
  state.hoverGridCell = null;
  state.hoverLine = null;
  clearGridLineSelection();
  updateUi();
  draw();
}

function toggleGridCell(cell) {
  const key = gridCellKey(cell.row, cell.column);
  if (state.grid.selectedCells.has(key)) {
    state.grid.selectedCells.delete(key);
  } else {
    state.grid.selectedCells.add(key);
  }
  updateUi();
  draw();
}

function deleteSelectedGridLine() {
  const selectedLine = state.selectedGridLine;
  if (state.mode !== 'nine' || !selectedLine) return;
  const lines = state.grid[selectedLine.orientation];
  if (!lines || selectedLine.index < 0 || selectedLine.index >= lines.length) return;
  lines.splice(selectedLine.index, 1);
  clearGridSelectionForTopologyChange();
  clearSmartAnalysis();
  updateUi();
  draw();
  showToast('已删除裁切线');
}

function pointInCrop(point) {
  const { x, y, w, h } = state.crop;
  return point.x >= x && point.x <= x + w && point.y >= y && point.y <= y + h;
}

function updateCanvasCursor(point) {
  if (!state.image) {
    canvas.style.cursor = 'default';
    return;
  }
  if (state.keyboard.space) {
    canvas.style.cursor = 'grab';
    return;
  }
  if (state.mode === 'smart') {
    const handle = smartHandleAt(point);
    const candidate = smartCandidateAt(point);
    if (handle) {
      canvas.style.cursor = handle === 'n' || handle === 's'
        ? 'ns-resize'
        : (handle === 'e' || handle === 'w' ? 'ew-resize' : (handle === 'ne' || handle === 'sw' ? 'nesw-resize' : 'nwse-resize'));
    } else {
      canvas.style.cursor = candidate ? 'move' : 'default';
    }
    return;
  }
  const corner = cornerAt(point);
  if (state.mode === 'nine' && state.grid.tool === 'select') {
    const cell = corner ? null : gridCellAt(point);
    const cellChanged = state.hoverGridCell?.row !== cell?.row || state.hoverGridCell?.column !== cell?.column;
    state.hoverGridCell = cell;
    state.hoverLine = null;
    if (cellChanged) draw();
    if (corner) {
      canvas.style.cursor = corner === 'ne' || corner === 'sw' ? 'nesw-resize' : 'nwse-resize';
    } else {
      canvas.style.cursor = cell ? 'pointer' : 'default';
    }
    return;
  }
  const line = gridLineAt(point);
  const previousHover = state.hoverLine;
  const previousGridCell = state.hoverGridCell;
  state.hoverLine = line ? { orientation: line.orientation, index: line.index } : null;
  state.hoverGridCell = null;
  if (
    previousHover?.orientation !== state.hoverLine?.orientation
    || previousHover?.index !== state.hoverLine?.index
    || previousGridCell
  ) draw();
  if (corner) {
    canvas.style.cursor = corner === 'ne' || corner === 'sw' ? 'nesw-resize' : 'nwse-resize';
  } else if (line) {
    canvas.style.cursor = line.orientation === 'vertical' ? 'col-resize' : 'row-resize';
  } else {
    canvas.style.cursor = pointInCrop(point) ? 'grab' : 'default';
  }
}

function moveGridLine(interaction, point) {
  const isVertical = interaction.orientation === 'vertical';
  const relativePosition = isVertical
    ? (point.x - state.crop.x) / state.crop.w
    : (point.y - state.crop.y) / state.crop.h;
  const lines = state.grid[interaction.orientation];
  const lowerBound = interaction.index === 0 ? 0 : lines[interaction.index - 1];
  const upperBound = interaction.index === lines.length - 1 ? 1 : lines[interaction.index + 1];
  lines[interaction.index] = clamp(relativePosition, lowerBound + GRID_LINE_MIN_GAP, upperBound - GRID_LINE_MIN_GAP);
}

function clampSmartBounds(bounds) {
  const minWidth = Math.min(1, Math.max(0.018, MIN_CROP_SIZE / state.crop.w));
  const minHeight = Math.min(1, Math.max(0.018, MIN_CROP_SIZE / state.crop.h));
  const w = clamp(bounds.w, minWidth, 1);
  const h = clamp(bounds.h, minHeight, 1);
  return { x: clamp(bounds.x, 0, 1 - w), y: clamp(bounds.y, 0, 1 - h), w, h };
}

function moveSmartCandidate(interaction, point) {
  const candidate = state.smart.candidates.find((item) => item.id === interaction.candidateId);
  if (!candidate) return;
  const dx = (point.x - interaction.point.x) / state.crop.w;
  const dy = (point.y - interaction.point.y) / state.crop.h;
  candidate.bounds = clampSmartBounds({ ...interaction.bounds, x: interaction.bounds.x + dx, y: interaction.bounds.y + dy });
}

function resizeSmartCandidate(interaction, point) {
  const candidate = state.smart.candidates.find((item) => item.id === interaction.candidateId);
  if (!candidate) return;
  const dx = (point.x - interaction.point.x) / state.crop.w;
  const dy = (point.y - interaction.point.y) / state.crop.h;
  const handle = interaction.handle;
  const original = interaction.bounds;
  const minWidth = Math.min(1, Math.max(0.018, MIN_CROP_SIZE / state.crop.w));
  const minHeight = Math.min(1, Math.max(0.018, MIN_CROP_SIZE / state.crop.h));
  let next = { ...original };

  if (handle.length === 2) {
    const horizontalDirection = handle.includes('w') ? -1 : 1;
    const verticalDirection = handle.includes('n') ? -1 : 1;
    const ratio = original.w / original.h;
    const widthDelta = Math.abs(dx) > Math.abs(dy) * ratio ? dx * horizontalDirection : dy * verticalDirection * ratio;
    const width = Math.max(minWidth, original.w + widthDelta);
    const height = Math.max(minHeight, width / ratio);
    next.w = width;
    next.h = height;
    if (handle.includes('w')) next.x = original.x + original.w - width;
    if (handle.includes('n')) next.y = original.y + original.h - height;
  } else {
    if (handle === 'w') { next.x = original.x + dx; next.w = original.w - dx; }
    if (handle === 'e') next.w = original.w + dx;
    if (handle === 'n') { next.y = original.y + dy; next.h = original.h - dy; }
    if (handle === 's') next.h = original.h + dy;
    if (next.w < minWidth || next.h < minHeight) return;
  }
  candidate.bounds = clampSmartBounds(next);
}

function beginInteraction(event) {
  if (!state.image) return;
  const screenPoint = getScreenPoint(event);
  if (event.button === 1 || (event.button === 0 && state.keyboard.space)) {
    event.preventDefault();
    state.interaction = { type: 'pan-view', screenPoint, pan: { ...state.view.pan } };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('is-dragging');
    return;
  }
  if (event.button !== 0) return;
  const point = screenToWorld(screenPoint);
  if (state.mode === 'smart') {
    const handle = smartHandleAt(point);
    const candidate = handle ? activeSmartCandidate() : smartCandidateAt(point);
    if (candidate) {
      state.smart.activeId = candidate.id;
      state.interaction = {
        type: handle ? 'resize-smart-candidate' : 'move-smart-candidate',
        candidateId: candidate.id,
        handle,
        point,
        bounds: { ...candidateBounds(candidate) },
      };
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add('is-dragging');
      updateUi();
      draw();
      return;
    }
  }
  const corner = cornerAt(point);
  const gridCell = corner ? null : gridCellAt(point);
  const gridLine = gridLineAt(point);
  if (gridCell) {
    toggleGridCell(gridCell);
    return;
  }
  if (!corner && !pointInCrop(point)) return;
  if (state.mode === 'nine' && state.grid.tool === 'select' && !corner) return;
  if (gridLine) {
    state.selectedGridLine = { orientation: gridLine.orientation, index: gridLine.index };
    state.hoverGridCell = null;
    draw();
  }
  state.interaction = {
    type: gridLine ? 'move-grid-line' : (corner ? 'resize' : 'move-image'),
    corner,
    orientation: gridLine?.orientation,
    index: gridLine?.index,
    point,
    crop: { ...state.crop },
    imageOffset: { ...state.imageOffset },
  };
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add('is-dragging');
}

function resizeCrop(interaction, point) {
  const dx = point.x - interaction.point.x;
  const dy = point.y - interaction.point.y;
  const original = interaction.crop;
  const ratio = ratioValue();
  let next = { ...original };
  const signX = interaction.corner.includes('w') ? -1 : 1;
  const signY = interaction.corner.includes('n') ? -1 : 1;
  if (ratio) {
    const widthDelta = Math.abs(dx) > Math.abs(dy) * ratio ? dx * signX : dy * signY * ratio;
    const width = Math.max(MIN_CROP_SIZE, original.w + widthDelta);
    const height = width / ratio;
    next.w = width;
    next.h = height;
    if (interaction.corner.includes('w')) next.x = original.x + original.w - width;
    if (interaction.corner.includes('n')) next.y = original.y + original.h - height;
  } else {
    if (interaction.corner.includes('w')) { next.x = original.x + dx; next.w = original.w - dx; }
    if (interaction.corner.includes('e')) next.w = original.w + dx;
    if (interaction.corner.includes('n')) { next.y = original.y + dy; next.h = original.h - dy; }
    if (interaction.corner.includes('s')) next.h = original.h + dy;
    if (next.w < MIN_CROP_SIZE || next.h < MIN_CROP_SIZE) return;
  }
  state.crop = next;
  clampCrop();
  clampImagePosition();
  syncOutputSize();
}

function moveInteraction(event) {
  const screenPoint = getScreenPoint(event);
  const point = screenToWorld(screenPoint);
  if (!state.interaction) {
    updateCanvasCursor(point);
    return;
  }
  if (state.interaction.type === 'pan-view') {
    state.view.pan.x = state.interaction.pan.x + screenPoint.x - state.interaction.screenPoint.x;
    state.view.pan.y = state.interaction.pan.y + screenPoint.y - state.interaction.screenPoint.y;
  } else if (state.interaction.type === 'move-smart-candidate') {
    moveSmartCandidate(state.interaction, point);
  } else if (state.interaction.type === 'resize-smart-candidate') {
    resizeSmartCandidate(state.interaction, point);
  } else if (state.interaction.type === 'move-image') {
    state.imageOffset.x = state.interaction.imageOffset.x + point.x - state.interaction.point.x;
    state.imageOffset.y = state.interaction.imageOffset.y + point.y - state.interaction.point.y;
    clampImagePosition();
  } else if (state.interaction.type === 'move-grid-line') {
    moveGridLine(state.interaction, point);
  } else {
    resizeCrop(state.interaction, point);
  }
  draw();
}

function endInteraction(event) {
  if (!state.interaction) return;
  const completedInteraction = state.interaction;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  state.interaction = null;
  canvas.classList.remove('is-dragging');
  if (completedInteraction.type === 'move-grid-line') clearGridCellSelection();
  if (!['move-smart-candidate', 'resize-smart-candidate', 'pan-view'].includes(completedInteraction.type)) clearSmartAnalysis();
  updateUi();
  draw();
  updateCanvasCursor(screenToWorld(getScreenPoint(event)));
}

function setControlsEnabled(enabled) {
  [
    controls.export,
    controls.wideExport,
    controls.rotateLeft,
    controls.rotateRight,
    controls.flipHorizontal,
    controls.flipVertical,
    controls.gridEditMode,
    controls.gridSelectMode,
    controls.addVerticalLine,
    controls.addHorizontalLine,
    controls.resetGridLines,
    controls.analyzeSmart,
  ].forEach((control) => { control.disabled = !enabled; });
}

function imageFileInfo(image) {
  return `${image.naturalWidth} x ${image.naturalHeight}`;
}

function setFilePreview(file) {
  const thumb = document.createElement('img');
  thumb.src = state.imageUrl;
  thumb.alt = '';
  document.querySelector('.file-thumb').replaceChildren(thumb);
  controls.fileRow.classList.remove('is-empty');
  controls.fileName.textContent = file.name;
  controls.fileInfo.textContent = imageFileInfo(state.image);
  controls.fileCount.textContent = '1 / 1';
  controls.canvasTitle.textContent = file.name;
}

function loadFile(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    showToast('请选择 JPG、PNG 或 WEBP 图片');
    return;
  }
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
  state.imageUrl = URL.createObjectURL(file);
  state.imageName = file.name.replace(/\.[^.]+$/, '') || 'cropped-image';
  state.imageType = file.type;
  const image = new Image();
  image.onload = () => {
    state.image = image;
    state.ratio = 'source';
    updateRatioOptions();
    state.view = { scale: 1, pan: { x: 0, y: 0 } };
    state.imageOffset = { x: 0, y: 0 };
    state.zoom = 1;
    state.rotation = 0;
    state.flipX = 1;
    state.flipY = 1;
    controls.zoom.value = '1';
    clearSmartAnalysis();
    resetGridLines();
    setCropForRatio();
    setFilePreview(file);
    canvasEmpty.classList.add('is-hidden');
    setControlsEnabled(true);
    if (state.mode === 'smart') {
      analyzeSmartCrops();
      return;
    }
    updateUi();
    draw();
  };
  image.onerror = () => showToast('图片无法读取，请更换文件');
  image.src = state.imageUrl;
}

function syncOutputSize(changed = 'width') {
  if (!state.image) return;
  const cropRatio = currentCropRatio();
  const width = Math.max(1, Number(controls.outputWidth.value) || round(state.image.naturalWidth));
  const height = Math.max(1, Number(controls.outputHeight.value) || round(state.image.naturalHeight));
  if (changed === 'height') {
    controls.outputWidth.value = round(height * cropRatio);
  } else {
    controls.outputHeight.value = round(width / cropRatio);
  }
  updateExportSummary();
}

function updateExportSummary() {
  const width = Math.max(1, Number(controls.outputWidth.value) || 1);
  const height = Math.max(1, Number(controls.outputHeight.value) || 1);
  const type = state.format === 'image/png' ? 'PNG' : 'JPG';
  if (state.mode === 'nine') {
    controls.exportSpec.textContent = `${width} x ${height} px · ${selectedGridCellCount()} 张`;
    controls.exportFormat.textContent = `${type} · ZIP`;
  } else if (state.mode === 'smart') {
    controls.exportSpec.textContent = `${width} x ${height} px · ${selectedSmartCandidateCount()} 张`;
    controls.exportFormat.textContent = `${type} · ZIP`;
  } else {
    controls.exportSpec.textContent = `${width} x ${height} px`;
    controls.exportFormat.textContent = type;
  }
}

function updateUi() {
  const imageZoomPercent = round(state.zoom * 100);
  controls.zoomValue.textContent = `${imageZoomPercent}%`;
  controls.zoomReadout.textContent = `画布 ${round(state.view.scale * 100)}%`;
  controls.rotationReadout.textContent = `${state.rotation}deg`;
  controls.qualityValue.textContent = `${round(state.quality * 100)}%`;
  controls.qualityControl.classList.toggle('is-hidden', state.format === 'image/png');
  const isNineGrid = state.mode === 'nine';
  const isSmartMode = state.mode === 'smart';
  const tileCount = gridTileCount();
  const selectedGridCount = selectedGridCellCount();
  const smartCount = selectedSmartCandidateCount();
  controls.headerExportLabel.textContent = isNineGrid || isSmartMode ? '导出 ZIP' : '导出';
  controls.wideExportLabel.textContent = isNineGrid
    ? (selectedGridCount ? `导出压缩包 ${selectedGridCount} 张` : '选择裁切内容')
    : (isSmartMode ? `导出压缩包 ${smartCount} 张` : '导出图片');
  controls.export.setAttribute('aria-label', isNineGrid || isSmartMode ? '导出压缩包' : '导出图片');
  controls.modeNote.textContent = isNineGrid ? `${selectedGridCount} / ${tileCount} 个已选` : (isSmartMode ? '本地识别完整画面' : '导出当前裁切范围');
  controls.gridControls.classList.toggle('is-hidden', !isNineGrid);
  controls.smartExportMode.classList.toggle('is-hidden', !isSmartMode);
  [controls.gridEditMode, controls.gridSelectMode].forEach((button) => {
    const selected = button.dataset.gridTool === state.grid.tool;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-checked', String(selected));
  });
  document.querySelectorAll('.smart-export-option').forEach((button) => {
    const selected = button.dataset.smartExport === state.smart.exportMode;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-checked', String(selected));
  });
  document.querySelectorAll('.format-option').forEach((button) => {
    const cannotUseJpg = isSmartMode && state.smart.exportMode === 'shape' && button.dataset.format === 'image/jpeg';
    button.disabled = cannotUseJpg;
    button.title = cannotUseJpg ? '保留图框时需要 PNG 透明背景' : '';
  });
  const canExport = Boolean(state.image)
    && (!isNineGrid || selectedGridCount > 0)
    && (!isSmartMode || smartCount > 0);
  controls.export.disabled = !canExport;
  controls.wideExport.disabled = !canExport;
  renderSmartCandidates();
  updateExportSummary();
}

function chooseRatio(button) {
  state.ratio = button.dataset.ratio === 'free' || button.dataset.ratio === 'source'
    ? button.dataset.ratio
    : Number(button.dataset.ratio);
  updateRatioOptions();
  if (state.image) {
    clearSmartAnalysis();
    setCropForRatio(true);
    draw();
  }
}

function chooseFormat(button) {
  if (button.disabled) {
    showToast('保留图框时需要使用 PNG 格式');
    return;
  }
  setFormat(button.dataset.format);
  updateUi();
}

function setFormat(format) {
  document.querySelectorAll('.format-option').forEach((option) => {
    const selected = option.dataset.format === format;
    option.classList.toggle('is-selected', selected);
    option.setAttribute('aria-checked', String(selected));
  });
  state.format = format;
}

function chooseSmartExportMode(button) {
  state.smart.exportMode = button.dataset.smartExport;
  if (state.smart.exportMode === 'shape') setFormat('image/png');
  updateUi();
}

function chooseMode(button) {
  document.querySelectorAll('.mode-option').forEach((option) => {
    const selected = option === button;
    option.classList.toggle('is-selected', selected);
    option.setAttribute('aria-checked', String(selected));
  });
  state.mode = button.dataset.mode;
  if (state.mode === 'smart' && state.smart.exportMode === 'shape') setFormat('image/png');
  if (state.mode === 'smart' && state.image && !state.smart.candidates.length) {
    analyzeSmartCrops();
    return;
  }
  updateUi();
  draw();
}

function renderExportCanvas(outputWidth, outputHeight) {
  const result = document.createElement('canvas');
  result.width = outputWidth;
  result.height = outputHeight;
  const exportContext = result.getContext('2d');
  if (state.format === 'image/jpeg') {
    exportContext.fillStyle = '#ffffff';
    exportContext.fillRect(0, 0, outputWidth, outputHeight);
  }
  const scale = outputWidth / state.crop.w;
  exportContext.translate(outputWidth / 2, outputHeight / 2);
  exportContext.translate(state.imageOffset.x * scale, state.imageOffset.y * scale);
  exportContext.rotate((state.rotation * Math.PI) / 180);
  exportContext.scale(state.flipX, state.flipY);
  const renderedScale = imageScale() * scale;
  exportContext.drawImage(
    state.image,
    (-state.image.naturalWidth * renderedScale) / 2,
    (-state.image.naturalHeight * renderedScale) / 2,
    state.image.naturalWidth * renderedScale,
    state.image.naturalHeight * renderedScale,
  );
  return result;
}

function luminance(data, offset) {
  return data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
}

function regionVariance(imageData, x, y, width, height) {
  const { data } = imageData;
  const stride = Math.max(1, Math.floor(Math.sqrt((width * height) / 2400)));
  let total = 0;
  let totalSquares = 0;
  let count = 0;
  for (let sampleY = y; sampleY < y + height; sampleY += stride) {
    for (let sampleX = x; sampleX < x + width; sampleX += stride) {
      const value = luminance(data, (sampleY * imageData.width + sampleX) * 4);
      total += value;
      totalSquares += value * value;
      count += 1;
    }
  }
  return count ? totalSquares / count - (total / count) ** 2 : 0;
}

function seamDifference(imageData, first, second) {
  const { data, width, height } = imageData;
  const vertical = first.row === second.row;
  const seam = vertical ? Math.max(first.x, second.x) : Math.max(first.y, second.y);
  const start = vertical ? Math.max(first.y, second.y) : Math.max(first.x, second.x);
  const end = vertical
    ? Math.min(first.y + first.h, second.y + second.h)
    : Math.min(first.x + first.w, second.x + second.w);
  const samples = Math.max(4, Math.min(28, Math.floor((end - start) / 6)));
  let total = 0;
  for (let index = 0; index < samples; index += 1) {
    const point = Math.round(start + ((index + 0.5) / samples) * (end - start));
    const leftX = vertical ? clamp(seam - 2, 0, width - 1) : clamp(point, 0, width - 1);
    const leftY = vertical ? clamp(point, 0, height - 1) : clamp(seam - 2, 0, height - 1);
    const rightX = vertical ? clamp(seam + 2, 0, width - 1) : clamp(point, 0, width - 1);
    const rightY = vertical ? clamp(point, 0, height - 1) : clamp(seam + 2, 0, height - 1);
    const leftOffset = (leftY * width + leftX) * 4;
    const rightOffset = (rightY * width + rightX) * 4;
    total += Math.abs(luminance(data, leftOffset) - luminance(data, rightOffset));
  }
  return total / samples;
}

function seamSeparatorContrast(imageData, first, second) {
  const { data, width, height } = imageData;
  const vertical = first.row === second.row;
  const seam = vertical ? Math.max(first.x, second.x) : Math.max(first.y, second.y);
  const start = vertical ? Math.max(first.y, second.y) : Math.max(first.x, second.x);
  const end = vertical
    ? Math.min(first.y + first.h, second.y + second.h)
    : Math.min(first.x + first.w, second.x + second.w);
  const cellThickness = vertical ? Math.min(first.w, second.w) : Math.min(first.h, second.h);
  const probeDistance = Math.max(4, Math.min(18, Math.floor(cellThickness / 8)));
  const samples = Math.max(4, Math.min(28, Math.floor((end - start) / 6)));
  let total = 0;
  for (let index = 0; index < samples; index += 1) {
    const point = Math.round(start + ((index + 0.5) / samples) * (end - start));
    const centerX = vertical ? clamp(seam, 0, width - 1) : clamp(point, 0, width - 1);
    const centerY = vertical ? clamp(point, 0, height - 1) : clamp(seam, 0, height - 1);
    const beforeX = vertical ? clamp(seam - probeDistance, 0, width - 1) : centerX;
    const beforeY = vertical ? centerY : clamp(seam - probeDistance, 0, height - 1);
    const afterX = vertical ? clamp(seam + probeDistance, 0, width - 1) : centerX;
    const afterY = vertical ? centerY : clamp(seam + probeDistance, 0, height - 1);
    const center = luminance(data, (centerY * width + centerX) * 4);
    const before = luminance(data, (beforeY * width + beforeX) * 4);
    const after = luminance(data, (afterY * width + afterX) * 4);
    total += Math.max(Math.abs(center - before), Math.abs(center - after));
  }
  return total / samples;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function smartDividerIndexes(edges, sourceLength) {
  const sizes = edges.slice(1).map((edge, index) => edge - edges[index]);
  if (sizes.length <= 3) return new Set();
  const typicalSize = median(sizes);
  if (!typicalSize) return new Set();
  return new Set(sizes.flatMap((size, index) => (
    size <= typicalSize * SMART_DIVIDER_MAX_RELATIVE_SIZE
      && size <= sourceLength * SMART_DIVIDER_MAX_SOURCE_RATIO
      ? [index]
      : []
  )));
}

function isSmartCandidateLargeEnough(candidate) {
  return candidate.w * candidate.h >= SMART_MIN_CANDIDATE_AREA
    && Math.min(candidate.w, candidate.h) >= SMART_MIN_CANDIDATE_SIDE;
}

function axisProfiles(imageData, orientation) {
  const { data, width, height } = imageData;
  const isVertical = orientation === 'vertical';
  const axisLength = isVertical ? width : height;
  const crossLength = isVertical ? height : width;
  const crossStride = Math.max(1, Math.floor(crossLength / 180));
  return Array.from({ length: axisLength }, (_, position) => {
    let total = 0;
    let totalSquares = 0;
    let count = 0;
    for (let cross = 0; cross < crossLength; cross += crossStride) {
      const x = isVertical ? position : cross;
      const y = isVertical ? cross : position;
      const value = luminance(data, (y * width + x) * 4);
      total += value;
      totalSquares += value * value;
      count += 1;
    }
    const mean = total / count;
    return { mean, variance: totalSquares / count - mean * mean };
  });
}

function separatorBands(imageData, orientation) {
  const profiles = axisProfiles(imageData, orientation);
  const toneMedian = median(profiles.map((profile) => profile.mean));
  const toneSpread = median(profiles.map((profile) => Math.abs(profile.mean - toneMedian)));
  const textureMedian = median(profiles.map((profile) => profile.variance));
  const minBandWidth = Math.max(3, round(profiles.length * SMART_MIN_SEPARATOR_BAND_RATIO));
  const flags = profiles.map((profile) => {
    const hasDifferentTone = Math.abs(profile.mean - toneMedian) >= Math.max(4, toneSpread * 0.7);
    const isLowTexture = profile.variance <= Math.max(20, textureMedian * 0.65);
    const isVeryLowTexture = profile.variance <= Math.max(12, textureMedian * 0.25);
    return isLowTexture && (hasDifferentTone || isVeryLowTexture);
  });
  const bands = [];
  const runs = [];
  const toleratedGap = Math.max(1, minBandWidth - 1);
  let start = -1;
  let lastSeparator = -1;
  flags.forEach((isSeparator, index) => {
    if (!isSeparator) return;
    if (start < 0 || index - lastSeparator - 1 > toleratedGap) {
      if (start >= 0) runs.push({ start, end: lastSeparator + 1 });
      start = index;
    }
    lastSeparator = index;
  });
  if (start >= 0) runs.push({ start, end: lastSeparator + 1 });

  runs.forEach(({ start, end }) => {
    if (end - start >= minBandWidth && start > 0 && end < flags.length) {
      const inside = profiles.slice(start, end);
      const window = Math.max(minBandWidth, (end - start) * 2);
      const outside = [
        ...profiles.slice(Math.max(0, start - window), start),
        ...profiles.slice(end, Math.min(profiles.length, end + window)),
      ];
      const insideTone = inside.reduce((total, profile) => total + profile.mean, 0) / inside.length;
      const outsideTone = outside.reduce((total, profile) => total + profile.mean, 0) / outside.length;
      const insideTexture = inside.reduce((total, profile) => total + profile.variance, 0) / inside.length;
      const outsideTexture = outside.reduce((total, profile) => total + profile.variance, 0) / outside.length;
      if (
        Math.abs(insideTone - outsideTone) >= Math.max(5, toneSpread * 0.55)
        && insideTexture <= Math.max(20, outsideTexture * 0.8)
      ) bands.push({ start, end });
    }
  });
  return bands;
}

function contentSegments(length, bands) {
  const minContentSize = Math.max(1, round(length * SMART_MIN_CONTENT_SEGMENT_RATIO));
  const segments = [];
  let start = 0;
  bands.forEach((band) => {
    if (band.start - start >= minContentSize) segments.push({ start, end: band.start });
    start = band.end;
  });
  if (length - start >= minContentSize) segments.push({ start, end: length });
  return segments;
}

function pixelColor(data, width, x, y) {
  const offset = (y * width + x) * 4;
  return [data[offset], data[offset + 1], data[offset + 2]];
}

function colorDistance(first, second) {
  return Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2]);
}

function edgeBackground(imageData, bounds, orientation, fromEnd) {
  const { width, data } = imageData;
  const length = orientation === 'vertical' ? bounds.w : bounds.h;
  const crossStart = orientation === 'vertical' ? bounds.top : bounds.left;
  const crossEnd = orientation === 'vertical' ? bounds.bottom : bounds.right;
  const edgeOrigin = orientation === 'vertical' ? bounds.left : bounds.top;
  const probeDepth = Math.min(6, Math.max(1, Math.floor(length * 0.06)));
  const crossStep = Math.max(1, Math.floor((crossEnd - crossStart) / 80));
  const clusters = new Map();

  for (let depth = 0; depth < probeDepth; depth += 1) {
    const position = fromEnd ? edgeOrigin + length - 1 - depth : edgeOrigin + depth;
    for (let cross = crossStart; cross < crossEnd; cross += crossStep) {
      const x = orientation === 'vertical' ? position : cross;
      const y = orientation === 'vertical' ? cross : position;
      const color = pixelColor(data, width, x, y);
      const key = color.map((value) => Math.round(value / 16)).join(',');
      const cluster = clusters.get(key) || [];
      cluster.push(color);
      clusters.set(key, cluster);
    }
  }

  const samples = Array.from(clusters.values()).sort((first, second) => second.length - first.length)[0] || [];
  const reference = [0, 1, 2].map((index) => median(samples.map((color) => color[index])));
  const distances = samples.map((color) => colorDistance(color, reference));
  return { reference, threshold: clamp(median(distances) * 3 + 10, 16, 32) };
}

function backgroundRatioAtLine(imageData, bounds, orientation, position, reference, threshold) {
  const { width, data } = imageData;
  const acrossStart = orientation === 'vertical' ? bounds.top : bounds.left;
  const acrossEnd = orientation === 'vertical' ? bounds.bottom : bounds.right;
  const step = Math.max(1, Math.floor((acrossEnd - acrossStart) / 80));
  let background = 0;
  let count = 0;
  for (let across = acrossStart; across < acrossEnd; across += step) {
    const x = orientation === 'vertical' ? position : across;
    const y = orientation === 'vertical' ? across : position;
    if (colorDistance(pixelColor(data, width, x, y), reference) <= threshold) background += 1;
    count += 1;
  }
  return count ? background / count : 0;
}

function lineVarianceAt(imageData, bounds, orientation, position) {
  const { width, data } = imageData;
  const acrossStart = orientation === 'vertical' ? bounds.top : bounds.left;
  const acrossEnd = orientation === 'vertical' ? bounds.bottom : bounds.right;
  const step = Math.max(1, Math.floor((acrossEnd - acrossStart) / 90));
  let total = 0;
  let totalSquares = 0;
  let count = 0;
  for (let across = acrossStart; across < acrossEnd; across += step) {
    const x = orientation === 'vertical' ? position : across;
    const y = orientation === 'vertical' ? across : position;
    const value = luminance(data, (y * width + x) * 4);
    total += value;
    totalSquares += value * value;
    count += 1;
  }
  return count ? totalSquares / count - (total / count) ** 2 : 0;
}

function trimCandidateEdge(imageData, bounds, orientation, fromEnd) {
  const length = orientation === 'vertical' ? bounds.w : bounds.h;
  const origin = orientation === 'vertical' ? bounds.left : bounds.top;
  const maxTrim = Math.floor(length * SMART_TRIM_MAX_RELATIVE_SIZE);
  const { reference, threshold } = edgeBackground(imageData, bounds, orientation, fromEnd);
  let contentStreak = 0;
  for (let distance = 0; distance < maxTrim; distance += 1) {
    const position = fromEnd ? origin + length - 1 - distance : origin + distance;
    const backgroundRatio = backgroundRatioAtLine(imageData, bounds, orientation, position, reference, threshold);
    if (backgroundRatio >= SMART_TRIM_BACKGROUND_RATIO) {
      contentStreak = 0;
      continue;
    }
    if (backgroundRatio > SMART_TRIM_CONTENT_BACKGROUND_RATIO) {
      contentStreak = 0;
      continue;
    }
    contentStreak += 1;
    if (contentStreak >= SMART_TRIM_CONTENT_STREAK) return distance - contentStreak + 1;
  }
  return 0;
}

function trimCandidateToTexture(imageData, bounds, orientation, fromEnd) {
  const length = orientation === 'vertical' ? bounds.w : bounds.h;
  const origin = orientation === 'vertical' ? bounds.left : bounds.top;
  const maxTrim = Math.floor(length * SMART_TRIM_MAX_RELATIVE_SIZE);
  const threshold = Math.max(SMART_TRIM_MIN_LINE_VARIANCE, regionVariance(imageData, bounds.left, bounds.top, bounds.w, bounds.h) * 0.08);
  let contentStreak = 0;
  for (let distance = 0; distance < maxTrim; distance += 1) {
    const position = fromEnd ? origin + length - 1 - distance : origin + distance;
    if (lineVarianceAt(imageData, bounds, orientation, position) < threshold) {
      contentStreak = 0;
      continue;
    }
    contentStreak += 1;
    if (contentStreak >= SMART_TRIM_CONTENT_STREAK) return distance - contentStreak + 1;
  }
  return 0;
}

function trimCandidateToContent(imageData, candidate, textureEdges = {}) {
  const left = clamp(Math.round(candidate.x * imageData.width), 0, imageData.width - 1);
  const top = clamp(Math.round(candidate.y * imageData.height), 0, imageData.height - 1);
  const right = clamp(Math.round((candidate.x + candidate.w) * imageData.width), left + 1, imageData.width);
  const bottom = clamp(Math.round((candidate.y + candidate.h) * imageData.height), top + 1, imageData.height);
  const bounds = { left, top, right, bottom, w: right - left, h: bottom - top };
  const trimLeft = Math.max(
    trimCandidateEdge(imageData, bounds, 'vertical', false),
    textureEdges.left ? trimCandidateToTexture(imageData, bounds, 'vertical', false) : 0,
  );
  const trimRight = Math.max(
    trimCandidateEdge(imageData, bounds, 'vertical', true),
    textureEdges.right ? trimCandidateToTexture(imageData, bounds, 'vertical', true) : 0,
  );
  const trimTop = Math.max(
    trimCandidateEdge(imageData, bounds, 'horizontal', false),
    textureEdges.top ? trimCandidateToTexture(imageData, bounds, 'horizontal', false) : 0,
  );
  const trimBottom = Math.max(
    trimCandidateEdge(imageData, bounds, 'horizontal', true),
    textureEdges.bottom ? trimCandidateToTexture(imageData, bounds, 'horizontal', true) : 0,
  );
  const contentLeft = left + trimLeft;
  const contentTop = top + trimTop;
  const contentRight = right - trimRight;
  const contentBottom = bottom - trimBottom;
  const hasUsableContent = contentRight - contentLeft >= Math.max(12, bounds.w * 0.2)
    && contentBottom - contentTop >= Math.max(12, bounds.h * 0.2);
  const trimmed = {
    x: contentLeft / imageData.width,
    y: contentTop / imageData.height,
    w: (contentRight - contentLeft) / imageData.width,
    h: (contentBottom - contentTop) / imageData.height,
    selected: true,
  };
  if (!hasUsableContent) return candidate;
  return trimmed;
}

function alignOuterCandidateEdge(candidates, originals, indexes, edge) {
  const trims = indexes.map((index) => {
    const candidate = candidates[index];
    const original = originals[index];
    if (edge === 'left') return candidate.x - original.x;
    if (edge === 'right') return original.x + original.w - (candidate.x + candidate.w);
    if (edge === 'top') return candidate.y - original.y;
    return original.y + original.h - (candidate.y + candidate.h);
  });
  const dimension = edge === 'left' || edge === 'right' ? originals[indexes[0]].w : originals[indexes[0]].h;
  const meaningfulTrims = trims.filter((trim) => trim >= dimension * SMART_BORDER_CONSENSUS_MIN_TRIM_RATIO);
  if (meaningfulTrims.length < Math.ceil(indexes.length / 2)) return;
  const sharedTrim = Math.max(...meaningfulTrims);

  indexes.forEach((index) => {
    const candidate = candidates[index];
    const original = originals[index];
    const right = candidate.x + candidate.w;
    const bottom = candidate.y + candidate.h;
    if (edge === 'left') candidate.x = Math.max(candidate.x, original.x + sharedTrim);
    if (edge === 'right') candidate.w = Math.min(right, original.x + original.w - sharedTrim) - candidate.x;
    if (edge === 'top') candidate.y = Math.max(candidate.y, original.y + sharedTrim);
    if (edge === 'bottom') candidate.h = Math.min(bottom, original.y + original.h - sharedTrim) - candidate.y;
    if (edge === 'left') candidate.w = right - candidate.x;
    if (edge === 'top') candidate.h = bottom - candidate.y;
  });
}

function alignOuterCandidateEdges(candidates, originals, rowCount, columnCount) {
  const topRow = Array.from({ length: columnCount }, (_, column) => column);
  const bottomRow = Array.from({ length: columnCount }, (_, column) => (rowCount - 1) * columnCount + column);
  const leftColumn = Array.from({ length: rowCount }, (_, row) => row * columnCount);
  const rightColumn = Array.from({ length: rowCount }, (_, row) => row * columnCount + columnCount - 1);
  alignOuterCandidateEdge(candidates, originals, topRow, 'top');
  alignOuterCandidateEdge(candidates, originals, bottomRow, 'bottom');
  alignOuterCandidateEdge(candidates, originals, leftColumn, 'left');
  alignOuterCandidateEdge(candidates, originals, rightColumn, 'right');
  return candidates;
}

function detectSeparatedCandidates(imageData) {
  const verticalBands = separatorBands(imageData, 'vertical');
  const horizontalBands = separatorBands(imageData, 'horizontal');
  if (!verticalBands.length || !horizontalBands.length) return [];
  const columns = contentSegments(imageData.width, verticalBands);
  const rows = contentSegments(imageData.height, horizontalBands);
  if (columns.length * rows.length < 4) return [];
  const candidates = rows.flatMap((row) => columns.map((column) => ({
    x: column.start / imageData.width,
    y: row.start / imageData.height,
    w: (column.end - column.start) / imageData.width,
    h: (row.end - row.start) / imageData.height,
    selected: true,
  })));
  return alignOuterCandidateEdges(
    candidates.map((candidate, index) => {
      const row = Math.floor(index / columns.length);
      const column = index % columns.length;
      return trimCandidateToContent(imageData, candidate, {
        left: column === 0,
        right: column === columns.length - 1,
        top: row === 0,
        bottom: row === rows.length - 1,
      });
    }),
    candidates,
    rows.length,
    columns.length,
  ).filter(isSmartCandidateLargeEnough);
}

function detectGridCandidates(source, imageData) {
  const horizontalEdges = gridExportEdges(source.width, state.grid.vertical);
  const verticalEdges = gridExportEdges(source.height, state.grid.horizontal);
  const dividerColumns = smartDividerIndexes(horizontalEdges, source.width);
  const dividerRows = smartDividerIndexes(verticalEdges, source.height);
  const cells = [];
  const cellAt = [];

  for (let row = 0; row < verticalEdges.length - 1; row += 1) {
    cellAt[row] = [];
    for (let column = 0; column < horizontalEdges.length - 1; column += 1) {
      const x = horizontalEdges[column];
      const y = verticalEdges[row];
      const width = horizontalEdges[column + 1] - x;
      const height = verticalEdges[row + 1] - y;
      const isDivider = dividerColumns.has(column) || dividerRows.has(row);
      const variance = isDivider ? 0 : regionVariance(imageData, x, y, width, height);
      const cell = { x, y, w: width, h: height, row, column, active: variance >= SMART_MIN_VARIANCE };
      cellAt[row][column] = cells.length;
      cells.push(cell);
    }
  }

  const parent = cells.map((_, index) => index);
  const find = (index) => {
    let current = index;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]];
      current = parent[current];
    }
    return current;
  };
  const join = (first, second) => {
    const firstRoot = find(first);
    const secondRoot = find(second);
    if (firstRoot !== secondRoot) parent[secondRoot] = firstRoot;
  };

  cells.forEach((cell, index) => {
    if (!cell.active) return;
    const right = cellAt[cell.row][cell.column + 1];
    const below = cellAt[cell.row + 1]?.[cell.column];
    [right, below].forEach((neighborIndex) => {
      if (neighborIndex == null || !cells[neighborIndex].active) return;
      const neighbor = cells[neighborIndex];
      const joinsSmoothImage = seamDifference(imageData, cell, neighbor) <= SMART_MAX_SEAM_DIFFERENCE;
      const crossesVisibleDivider = seamSeparatorContrast(imageData, cell, neighbor) >= SMART_MIN_SEPARATOR_CONTRAST;
      if (joinsSmoothImage && !crossesVisibleDivider) join(index, neighborIndex);
    });
  });

  const groups = new Map();
  cells.forEach((cell, index) => {
    if (!cell.active) return;
    const root = find(index);
    const group = groups.get(root) || [];
    group.push(cell);
    groups.set(root, group);
  });

  return Array.from(groups.values())
    .map((group) => {
      const left = Math.min(...group.map((cell) => cell.x));
      const top = Math.min(...group.map((cell) => cell.y));
      const right = Math.max(...group.map((cell) => cell.x + cell.w));
      const bottom = Math.max(...group.map((cell) => cell.y + cell.h));
      return { x: left / source.width, y: top / source.height, w: (right - left) / source.width, h: (bottom - top) / source.height, selected: true };
    })
    .map((candidate) => trimCandidateToContent(imageData, candidate))
    .filter(isSmartCandidateLargeEnough)
    .sort((first, second) => first.y - second.y || first.x - second.x);
}

function edgeBackgroundReference(imageData) {
  const { width, height, data } = imageData;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 120));
  const clusters = new Map();
  const samples = [];
  const addSample = (x, y) => {
    const offset = (y * width + x) * 4;
    const color = [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]];
    samples.push(color);
    const key = color.slice(0, 3).map((value) => Math.round(value / 16)).join(',');
    const cluster = clusters.get(key) || [];
    cluster.push(color);
    clusters.set(key, cluster);
  };
  for (let x = 0; x < width; x += step) {
    addSample(x, 0);
    addSample(x, height - 1);
  }
  for (let y = step; y < height - 1; y += step) {
    addSample(0, y);
    addSample(width - 1, y);
  }
  const dominant = Array.from(clusters.values()).sort((first, second) => second.length - first.length)[0] || samples;
  const reference = [0, 1, 2].map((index) => median(dominant.map((color) => color[index])));
  const distances = dominant.map((color) => colorDistance(color, reference));
  const transparentRatio = samples.filter((color) => color[3] < 24).length / Math.max(1, samples.length);
  return {
    reference,
    threshold: clamp(median(distances) * 3 + 18, 28, 62),
    usesTransparency: transparentRatio > 0.18,
  };
}

function shapeContentMask(imageData) {
  const { width, height, data } = imageData;
  const { reference, threshold, usesTransparency } = edgeBackgroundReference(imageData);
  const mask = new Uint8Array(width * height);
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4;
    const alpha = data[offset + 3];
    if (alpha < 24) continue;
    if (usesTransparency || colorDistance([data[offset], data[offset + 1], data[offset + 2]], reference) > threshold) mask[index] = 1;
  }
  return mask;
}

function convexHull(points) {
  if (points.length <= 3) return points;
  const sorted = [...points].sort((first, second) => first.x - second.x || first.y - second.y);
  const cross = (origin, first, second) => (
    (first.x - origin.x) * (second.y - origin.y) - (first.y - origin.y) * (second.x - origin.x)
  );
  const lower = [];
  sorted.forEach((point) => {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  });
  const upper = [];
  sorted.slice().reverse().forEach((point) => {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  });
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function simplifyContour(points, maxPoints = 48) {
  if (points.length <= maxPoints) return points;
  return Array.from({ length: maxPoints }, (_, index) => points[Math.floor((index * points.length) / maxPoints)]);
}

function detectMaskCandidates(imageData, mask, { minAreaRatio = SMART_COMPONENT_MIN_AREA, minSideRatio = SMART_COMPONENT_MIN_SIDE, rectangular = false } = {}) {
  const { width, height } = imageData;
  const visited = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  const candidates = [];
  const minArea = width * height * minAreaRatio;

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    const boundary = [];
    visited[start] = 1;
    queue[tail++] = start;
    while (head < tail) {
      const current = queue[head++];
      const x = current % width;
      const y = Math.floor(current / width);
      area += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      let isBoundary = false;
      const neighbors = [
        x > 0 ? current - 1 : -1,
        x < width - 1 ? current + 1 : -1,
        y > 0 ? current - width : -1,
        y < height - 1 ? current + width : -1,
      ];
      neighbors.forEach((neighbor) => {
        if (neighbor < 0 || !mask[neighbor]) {
          isBoundary = true;
          return;
        }
        if (!visited[neighbor]) {
          visited[neighbor] = 1;
          queue[tail++] = neighbor;
        }
      });
      if (isBoundary) boundary.push({ x, y });
    }
    const boundsWidth = maxX - minX + 1;
    const boundsHeight = maxY - minY + 1;
    if (
      area < minArea
      || boundsWidth / width < minSideRatio
      || boundsHeight / height < minSideRatio
    ) continue;
    const fillsCanvas = boundsWidth / width > 0.94 && boundsHeight / height > 0.94;
    if (fillsCanvas) continue;
    const hull = simplifyContour(convexHull(boundary));
    if (hull.length < 3) continue;
    const candidate = {
      x: minX / width,
      y: minY / height,
      w: boundsWidth / width,
      h: boundsHeight / height,
      contour: rectangular ? undefined : hull.map((point) => ({
        x: clamp((point.x - minX) / boundsWidth, 0, 1),
        y: clamp((point.y - minY) / boundsHeight, 0, 1),
      })),
      selected: true,
    };
    if (isSmartCandidateLargeEnough(candidate)) candidates.push(candidate);
  }
  return candidates.sort((first, second) => first.y - second.y || first.x - second.x);
}

function detectContourCandidates(imageData) {
  return detectMaskCandidates(imageData, shapeContentMask(imageData));
}

function colorSaturation(red, green, blue) {
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  return maximum ? (maximum - minimum) / maximum : 0;
}

function obviousElementMasks(imageData) {
  const { data, width, height } = imageData;
  const lightSurface = new Uint8Array(width * height);
  const vividElement = new Uint8Array(width * height);
  for (let index = 0; index < lightSurface.length; index += 1) {
    const offset = index * 4;
    const alpha = data[offset + 3];
    if (alpha < 24) continue;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const brightness = luminance(data, offset);
    const saturation = colorSaturation(red, green, blue);
    if (brightness >= 188 && saturation <= 0.2) lightSurface[index] = 1;
    if (brightness >= 105 && saturation >= 0.5) vividElement[index] = 1;
  }
  return { lightSurface, vividElement };
}

function candidateIntersectionOverUnion(first, second) {
  const left = Math.max(first.x, second.x);
  const top = Math.max(first.y, second.y);
  const right = Math.min(first.x + first.w, second.x + second.w);
  const bottom = Math.min(first.y + first.h, second.y + second.h);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  const union = first.w * first.h + second.w * second.h - intersection;
  return union ? intersection / union : 0;
}

function uniqueElementCandidates(candidates) {
  return candidates
    .sort((first, second) => second.w * second.h - first.w * first.h)
    .reduce((unique, candidate) => (
      unique.some((existing) => candidateIntersectionOverUnion(existing, candidate) >= 0.72)
        ? unique
        : [...unique, candidate]
    ), [])
    .sort((first, second) => first.y - second.y || first.x - second.x);
}

function detectObviousElementCandidates(imageData) {
  const { lightSurface, vividElement } = obviousElementMasks(imageData);
  const panels = detectMaskCandidates(imageData, lightSurface, {
    minAreaRatio: 0.018,
    minSideRatio: 0.1,
    rectangular: true,
  });
  const buttons = detectMaskCandidates(imageData, vividElement, {
    minAreaRatio: 0.009,
    minSideRatio: 0.07,
    rectangular: true,
  });
  return uniqueElementCandidates([...panels, ...buttons]);
}

function detectSmartCandidates(source) {
  const context = source.getContext('2d', { willReadFrequently: true });
  const imageData = context.getImageData(0, 0, source.width, source.height);
  const obviousElements = detectObviousElementCandidates(imageData);
  if (obviousElements.length) return obviousElements;
  const contourCandidates = detectContourCandidates(imageData);
  if (contourCandidates.length >= 2) return contourCandidates;
  const separatedCandidates = detectSeparatedCandidates(imageData);
  return separatedCandidates.length ? separatedCandidates : detectGridCandidates(source, imageData);
}

function renderSmartCandidates() {
  const isSmartMode = state.mode === 'smart';
  controls.smartControls.classList.toggle('is-hidden', !isSmartMode);
  controls.smartCandidates.classList.toggle('is-hidden', !isSmartMode || !state.smart.candidates.length);
  controls.smartCandidates.replaceChildren();
  if (!state.smart.candidates.length) {
    controls.smartCount.textContent = '待分析';
    return;
  }
  controls.smartCount.textContent = `${selectedSmartCandidateCount()} / ${state.smart.candidates.length}`;
  state.smart.candidates.forEach((candidate, index) => {
    const button = document.createElement('button');
    button.className = `smart-candidate${candidate.selected ? ' is-selected' : ''}${candidate.id === state.smart.activeId ? ' is-active' : ''}`;
    button.type = 'button';
    button.dataset.candidateIndex = String(index);
    button.setAttribute('aria-pressed', String(candidate.selected));
    button.textContent = `${String(index + 1).padStart(2, '0')}`;
    controls.smartCandidates.append(button);
  });
}

function analyzeSmartCrops() {
  if (!state.image) return;
  const analysisWidth = 900;
  const analysisHeight = Math.max(1, round(analysisWidth / currentCropRatio()));
  state.smart.candidates = detectSmartCandidates(renderExportCanvas(analysisWidth, analysisHeight))
    .map((candidate, index) => ({
      id: `smart-${Date.now()}-${index}`,
      bounds: { x: candidate.x, y: candidate.y, w: candidate.w, h: candidate.h },
      contour: candidate.contour || [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
      selected: candidate.selected !== false,
    }));
  state.smart.activeId = state.smart.candidates[0]?.id || null;
  updateUi();
  draw();
  showToast(state.smart.candidates.length ? `已识别 ${state.smart.candidates.length} 个候选图片` : '未发现可导出的完整图片');
}

function toggleSmartCandidate(index) {
  const candidate = state.smart.candidates[index];
  if (!candidate) return;
  candidate.selected = !candidate.selected;
  updateUi();
  draw();
}

function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function canvasToBlob(source) {
  return new Promise((resolve) => source.toBlob(resolve, state.format, state.quality));
}

function gridExportEdges(length, lines) {
  const edges = [0];
  lines.forEach((line) => {
    const edge = clamp(Math.round(length * line), 0, length);
    if (edge > edges[edges.length - 1] && edge < length) edges.push(edge);
  });
  edges.push(length);
  return edges;
}

function createExportTile(source, left, top, right, bottom) {
  const tile = document.createElement('canvas');
  tile.width = Math.max(1, right - left);
  tile.height = Math.max(1, bottom - top);
  tile.getContext('2d').drawImage(source, left, top, tile.width, tile.height, 0, 0, tile.width, tile.height);
  return tile;
}

function smartCandidateExportBounds(candidate, outputWidth, outputHeight) {
  const bounds = candidateBounds(candidate);
  const left = clamp(round(bounds.x * outputWidth), 0, Math.max(0, outputWidth - 1));
  const top = clamp(round(bounds.y * outputHeight), 0, Math.max(0, outputHeight - 1));
  const right = clamp(round((bounds.x + bounds.w) * outputWidth), left + 1, outputWidth);
  const bottom = clamp(round((bounds.y + bounds.h) * outputHeight), top + 1, outputHeight);
  return { left, top, right, bottom };
}

function createSmartExportTile(source, candidate, outputWidth, outputHeight) {
  const { left, top, right, bottom } = smartCandidateExportBounds(candidate, outputWidth, outputHeight);
  if (state.smart.exportMode !== 'shape') return createExportTile(source, left, top, right, bottom);
  const tile = document.createElement('canvas');
  tile.width = Math.max(1, right - left);
  tile.height = Math.max(1, bottom - top);
  const tileContext = tile.getContext('2d');
  const bounds = candidateBounds(candidate);
  const points = candidateContour(candidate).map((point) => ({
    x: (bounds.x + point.x * bounds.w) * outputWidth - left,
    y: (bounds.y + point.y * bounds.h) * outputHeight - top,
  }));
  tileContext.save();
  if (points.length) {
    tileContext.beginPath();
    tileContext.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => tileContext.lineTo(point.x, point.y));
    tileContext.closePath();
    tileContext.clip();
  }
  tileContext.drawImage(source, left, top, tile.width, tile.height, 0, 0, tile.width, tile.height);
  tileContext.restore();
  return tile;
}

async function exportTilesAsZip(tiles, extension, archiveName) {
  if (!window.JSZip) {
    showToast('压缩组件未加载，请检查网络后重试');
    return;
  }
  const zip = new window.JSZip();
  const blobs = await Promise.all(tiles.map(({ tile }) => canvasToBlob(tile)));
  blobs.forEach((blob, index) => {
    if (blob) zip.file(tiles[index].filename, blob);
  });
  if (!Object.keys(zip.files).length) {
    showToast('没有可打包的图片');
    return;
  }
  const archive = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  downloadBlob(archive, `${state.imageName}-${archiveName}.zip`);
  showToast(`已导出压缩包，含 ${tiles.length} 张图片`);
}

async function exportGrid(fullCanvas, outputWidth, outputHeight, extension) {
  const cells = selectedGridCells();
  if (!cells.length) {
    showToast('请先选择要裁切的内容');
    return;
  }
  const tiles = cells.map((cell, index) => {
    const { left, top, right, bottom } = gridCellBounds(cell.row, cell.column);
    const startX = clamp(round(left * outputWidth), 0, Math.max(0, outputWidth - 1));
    const startY = clamp(round(top * outputHeight), 0, Math.max(0, outputHeight - 1));
    const endX = clamp(round(right * outputWidth), startX + 1, outputWidth);
    const endY = clamp(round(bottom * outputHeight), startY + 1, outputHeight);
    return {
      tile: createExportTile(fullCanvas, startX, startY, endX, endY),
      filename: `${state.imageName}-grid-${String(index + 1).padStart(2, '0')}.${extension}`,
    };
  });
  await exportTilesAsZip(tiles, extension, 'grid');
}

async function exportSmartCrops(fullCanvas, outputWidth, outputHeight, extension) {
  if (!state.smart.candidates.length) analyzeSmartCrops();
  const selectedCandidates = state.smart.candidates.filter((candidate) => candidate.selected);
  if (!selectedCandidates.length) {
    showToast('请至少选择一张候选图片');
    return;
  }
  const tiles = selectedCandidates.map((candidate, index) => {
    return {
      tile: createSmartExportTile(fullCanvas, candidate, outputWidth, outputHeight),
      filename: `${state.imageName}-smart-${String(index + 1).padStart(2, '0')}.${extension}`,
    };
  });
  await exportTilesAsZip(tiles, extension, state.smart.exportMode === 'shape' ? 'smart-shapes' : 'smart-crops');
}

async function exportImage() {
  if (!state.image) return;
  const outputWidth = clamp(round(Number(controls.outputWidth.value) || 1600), 1, 10000);
  const outputHeight = clamp(round(Number(controls.outputHeight.value) || 1600), 1, 10000);
  controls.outputWidth.value = outputWidth;
  controls.outputHeight.value = outputHeight;
  const result = renderExportCanvas(outputWidth, outputHeight);
  const extension = state.format === 'image/png' ? 'png' : 'jpg';
  if (state.mode === 'nine') {
    await exportGrid(result, outputWidth, outputHeight, extension);
    return;
  }
  if (state.mode === 'smart') {
    await exportSmartCrops(result, outputWidth, outputHeight, extension);
    return;
  }
  result.toBlob((blob) => {
    if (!blob) return;
    downloadBlob(blob, `${state.imageName}-cropped.${extension}`);
    showToast(`已导出 ${outputWidth} x ${outputHeight} ${extension.toUpperCase()}`);
  }, state.format, state.quality);
}

function hasFiles(event) {
  return Array.from(event.dataTransfer?.types || []).includes('Files');
}

function setCanvasDragging(isDragging) {
  canvasWrap.classList.toggle('is-dragging', isDragging);
  canvasDropHint.classList.toggle('is-visible', isDragging);
}

function acceptDroppedFile(event) {
  event.preventDefault();
  setCanvasDragging(false);
  loadFile(event.dataTransfer?.files?.[0]);
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2500);
}

fileInput.addEventListener('change', (event) => loadFile(event.target.files?.[0]));
uploadDrop.addEventListener('dragover', (event) => { event.preventDefault(); uploadDrop.classList.add('is-dragging'); });
uploadDrop.addEventListener('dragleave', () => uploadDrop.classList.remove('is-dragging'));
uploadDrop.addEventListener('drop', (event) => { event.preventDefault(); uploadDrop.classList.remove('is-dragging'); loadFile(event.dataTransfer.files?.[0]); });

canvasWrap.addEventListener('dragenter', (event) => { if (hasFiles(event)) { event.preventDefault(); setCanvasDragging(true); } });
canvasWrap.addEventListener('dragover', (event) => { if (hasFiles(event)) { event.preventDefault(); setCanvasDragging(true); } });
canvasWrap.addEventListener('dragleave', (event) => { if (event.target === canvasWrap) setCanvasDragging(false); });
canvasWrap.addEventListener('drop', acceptDroppedFile);
document.addEventListener('dragover', (event) => { if (hasFiles(event)) event.preventDefault(); });
document.addEventListener('drop', (event) => {
  if (!hasFiles(event)) return;
  event.preventDefault();
  if (!canvasWrap.contains(event.target) && !uploadDrop.contains(event.target)) acceptDroppedFile(event);
});

document.querySelectorAll('.ratio-option').forEach((button) => button.addEventListener('click', () => chooseRatio(button)));
document.querySelectorAll('.format-option').forEach((button) => button.addEventListener('click', () => chooseFormat(button)));
document.querySelectorAll('.mode-option').forEach((button) => button.addEventListener('click', () => chooseMode(button)));
document.querySelectorAll('.smart-export-option').forEach((button) => button.addEventListener('click', () => chooseSmartExportMode(button)));
controls.addVerticalLine.addEventListener('click', () => addGridLine('vertical'));
controls.addHorizontalLine.addEventListener('click', () => addGridLine('horizontal'));
controls.resetGridLines.addEventListener('click', resetGridLines);
controls.gridEditMode.addEventListener('click', () => chooseGridTool('edit'));
controls.gridSelectMode.addEventListener('click', () => chooseGridTool('select'));
controls.analyzeSmart.addEventListener('click', analyzeSmartCrops);
controls.smartCandidates.addEventListener('click', (event) => {
  const button = event.target.closest('[data-candidate-index]');
  if (button) toggleSmartCandidate(Number(button.dataset.candidateIndex));
});
controls.zoom.addEventListener('input', () => { state.zoom = Number(controls.zoom.value); clampImagePosition(); clearSmartAnalysis(); updateUi(); draw(); });
controls.quality.addEventListener('input', () => { state.quality = Number(controls.quality.value); updateUi(); });
controls.rotateLeft.addEventListener('click', () => { state.rotation = (state.rotation - 90 + 360) % 360; clampImagePosition(); clearSmartAnalysis(); updateUi(); draw(); });
controls.rotateRight.addEventListener('click', () => { state.rotation = (state.rotation + 90) % 360; clampImagePosition(); clearSmartAnalysis(); updateUi(); draw(); });
controls.flipHorizontal.addEventListener('click', () => { state.flipX *= -1; clearSmartAnalysis(); updateUi(); draw(); });
controls.flipVertical.addEventListener('click', () => { state.flipY *= -1; clearSmartAnalysis(); updateUi(); draw(); });
controls.export.addEventListener('click', exportImage);
controls.wideExport.addEventListener('click', exportImage);
controls.themeToggle.addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'));
controls.outputWidth.addEventListener('change', () => syncOutputSize('width'));
controls.outputHeight.addEventListener('change', () => syncOutputSize('height'));
controls.matchRatio.addEventListener('click', () => syncOutputSize('width'));
document.addEventListener('keydown', (event) => {
  if (event.target instanceof Element && event.target.matches('input, textarea, select, [contenteditable="true"]')) return;
  if (event.code === 'Space') {
    state.keyboard.space = true;
    event.preventDefault();
    canvas.style.cursor = state.image ? 'grab' : 'default';
    return;
  }
  if (event.key !== 'Delete' && event.key !== 'Backspace') return;
  if (state.mode !== 'nine' || !state.selectedGridLine) return;
  event.preventDefault();
  deleteSelectedGridLine();
});
document.addEventListener('keyup', (event) => {
  if (event.code !== 'Space') return;
  state.keyboard.space = false;
  if (state.image) updateCanvasCursor(screenToWorld({ x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 }));
});
window.addEventListener('blur', () => { state.keyboard.space = false; });
canvas.addEventListener('pointerdown', beginInteraction);
canvas.addEventListener('pointermove', moveInteraction);
canvas.addEventListener('pointerup', endInteraction);
canvas.addEventListener('pointercancel', endInteraction);
canvas.addEventListener('wheel', (event) => {
  if (!state.image) return;
  event.preventDefault();
  const screenPoint = getScreenPoint(event);
  zoomViewAt(screenPoint, event.deltaY);
  updateUi();
  draw();
  updateCanvasCursor(screenToWorld(screenPoint));
}, { passive: false });
canvas.addEventListener('contextmenu', (event) => event.preventDefault());
canvas.addEventListener('pointerleave', () => {
  if (state.interaction) return;
  state.hoverLine = null;
  state.hoverGridCell = null;
  canvas.style.cursor = state.image ? 'grab' : 'default';
  draw();
});
window.addEventListener('resize', resizeCanvas);

if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 1.7 } });
updateThemeToggle();
resizeCanvas();

if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // The app remains fully usable when a host does not support service workers.
    });
  });
}
