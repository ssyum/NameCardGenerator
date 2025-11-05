// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Application State
const appState = {
  names: [],
  pdfTemplate: null,
  pdfTemplateData: null,
  customFont: null,
  customFontName: 'CustomFont',
  currentPage: 0,
  cache: {},
  selectedTextIndex: null,
  isDragging: false,
  dragOffset: { x: 0, y: 0 },
  canvasScale: 1
};

// Constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 1131;
const PDF_WIDTH = 595;
const PDF_HEIGHT = 842;
const NAMES_PER_PAGE = 4;
const DEFAULT_FONT_SIZE = 24;
const DEFAULT_LETTER_SPACING = 0;

// Quadrant centers (in PDF coordinates)
const QUADRANT_CENTERS = [
  { x: 148.75, y: 210.5, label: 'Top-left' },
  { x: 446.25, y: 210.5, label: 'Top-right' },
  { x: 148.75, y: 631.5, label: 'Bottom-left' },
  { x: 446.25, y: 631.5, label: 'Bottom-right' }
];

// DOM Elements
const elements = {
  csvFile: document.getElementById('csvFile'),
  csvFileName: document.getElementById('csvFileName'),
  textInput: document.getElementById('textInput'),
  nameCount: document.getElementById('nameCount'),
  nameCountText: document.getElementById('nameCountText'),
  loadNamesBtn: document.getElementById('loadNamesBtn'),
  pdfFile: document.getElementById('pdfFile'),
  pdfFileName: document.getElementById('pdfFileName'),
  loadPdfBtn: document.getElementById('loadPdfBtn'),
  fontFile: document.getElementById('fontFile'),
  fontFileName: document.getElementById('fontFileName'),
  loadFontBtn: document.getElementById('loadFontBtn'),
  skipFontBtn: document.getElementById('skipFontBtn'),
  editorCanvas: document.getElementById('editorCanvas'),
  prevPageBtn: document.getElementById('prevPageBtn'),
  nextPageBtn: document.getElementById('nextPageBtn'),
  pageInfo: document.getElementById('pageInfo'),
  textContentInput: document.getElementById('textContentInput'),
  fontSizeSlider: document.getElementById('fontSizeSlider'),
  fontSizeValue: document.getElementById('fontSizeValue'),
  letterSpacingSlider: document.getElementById('letterSpacingSlider'),
  letterSpacingValue: document.getElementById('letterSpacingValue'),
  centerTextBtn: document.getElementById('centerTextBtn'),
  generatePdfBtn: document.getElementById('generatePdfBtn'),
  loadingOverlay: document.getElementById('loadingOverlay'),
  loadingText: document.getElementById('loadingText'),
  errorContainer: document.getElementById('errorContainer')
};

// Utility Functions
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = message;
  elements.errorContainer.appendChild(errorDiv);
  
  setTimeout(() => {
    errorDiv.remove();
  }, 5000);
}

function showLoading(text = 'Processing...') {
  elements.loadingText.textContent = text;
  elements.loadingOverlay.classList.add('active');
}

function hideLoading() {
  elements.loadingOverlay.classList.remove('active');
}

function showStep(stepNumber) {
  document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
  document.getElementById(`step${stepNumber}`).classList.add('active');
}

// Step 1: Load Names
elements.csvFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    elements.csvFileName.textContent = file.name;
    elements.textInput.value = '';
  }
});

elements.loadNamesBtn.addEventListener('click', () => {
  const csvFile = elements.csvFile.files[0];
  const textInput = elements.textInput.value.trim();
  
  if (csvFile) {
    loadNamesFromCSV(csvFile);
  } else if (textInput) {
    loadNamesFromText(textInput);
  } else {
    showError('Please upload a CSV file or enter names in the text area');
  }
});

function loadNamesFromCSV(file) {
  showLoading('Parsing CSV...');
  
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      hideLoading();
      
      if (results.errors.length > 0) {
        showError('CSV parsing error: ' + results.errors[0].message);
        return;
      }
      
      const names = results.data.map(row => ({
        firstName: (row.FirstName || row.firstname || row.first_name || '').trim(),
        lastName: (row.LastName || row.lastname || row.last_name || '').trim()
      })).filter(name => name.firstName || name.lastName);
      
      if (names.length === 0) {
        showError('No valid names found in CSV');
        return;
      }
      
      appState.names = names;
      initializeCache();
      showNameCount();
      showStep(2);
    },
    error: (error) => {
      hideLoading();
      showError('Error reading CSV: ' + error.message);
    }
  });
}

function loadNamesFromText(text) {
  const lines = text.split('\n').filter(line => line.trim());
  
  const names = lines.map(line => {
    const parts = line.trim().split(/\s+/);
    return {
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || ''
    };
  }).filter(name => name.firstName || name.lastName);
  
  if (names.length === 0) {
    showError('No valid names found in text input');
    return;
  }
  
  appState.names = names;
  initializeCache();
  showNameCount();
  showStep(2);
}

function showNameCount() {
  elements.nameCount.style.display = 'block';
  elements.nameCountText.textContent = `${appState.names.length} names loaded`;
}

function initializeCache() {
  appState.cache = {};
  appState.names.forEach((name, index) => {
    const quadrantIndex = index % 4;
    const center = QUADRANT_CENTERS[quadrantIndex];
    
    appState.cache[index] = {
      x: center.x,
      y: center.y,
      fontSize: DEFAULT_FONT_SIZE,
      letterSpacing: DEFAULT_LETTER_SPACING,
      text: `${name.firstName}\n${name.lastName}`
    };
  });
}

// Step 2: Load PDF Template
elements.pdfFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    elements.pdfFileName.textContent = file.name;
  }
});

elements.loadPdfBtn.addEventListener('click', () => {
  const pdfFile = elements.pdfFile.files[0];
  
  if (!pdfFile) {
    showError('Please select a PDF file');
    return;
  }
  
  loadPDFTemplate(pdfFile);
});

function loadPDFTemplate(file) {
  showLoading('Loading PDF template...');
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const arrayBuffer = e.target.result;
      appState.pdfTemplateData = arrayBuffer;
      
      // Load PDF using pdf.js for preview
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      
      appState.pdfTemplate = page;
      
      hideLoading();
      showStep(3);
    } catch (error) {
      hideLoading();
      showError('Error loading PDF: ' + error.message);
    }
  };
  
  reader.onerror = () => {
    hideLoading();
    showError('Error reading PDF file');
  };
  
  reader.readAsArrayBuffer(file);
}

// Step 3: Load Font (Optional)
elements.fontFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    elements.fontFileName.textContent = file.name;
  }
});

elements.loadFontBtn.addEventListener('click', () => {
  const fontFile = elements.fontFile.files[0];
  
  if (!fontFile) {
    showError('Please select a font file');
    return;
  }
  
  loadCustomFont(fontFile);
});

elements.skipFontBtn.addEventListener('click', () => {
  showStep(4);
  initializeEditor();
});

function loadCustomFont(file) {
  showLoading('Loading font...');
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const arrayBuffer = e.target.result;
      appState.customFont = arrayBuffer;
      
      // Load font for canvas preview
      const fontFace = new FontFace(appState.customFontName, arrayBuffer);
      await fontFace.load();
      document.fonts.add(fontFace);
      
      hideLoading();
      showStep(4);
      initializeEditor();
    } catch (error) {
      hideLoading();
      showError('Error loading font: ' + error.message);
    }
  };
  
  reader.onerror = () => {
    hideLoading();
    showError('Error reading font file');
  };
  
  reader.readAsArrayBuffer(file);
}

// Step 4: Interactive Editor
function initializeEditor() {
  renderCanvas();
  updatePagination();
}

async function renderCanvas() {
  const canvas = elements.editorCanvas;
  const ctx = canvas.getContext('2d');
  
  // Set canvas dimensions
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  
  // Calculate scale
  appState.canvasScale = CANVAS_WIDTH / PDF_WIDTH;
  
  // Clear canvas
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Render PDF template
  if (appState.pdfTemplate) {
    const viewport = appState.pdfTemplate.getViewport({ scale: appState.canvasScale });
    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };
    await appState.pdfTemplate.render(renderContext).promise;
  }
  
  // Render text elements for current page
  renderTextElements(ctx);
}

function renderTextElements(ctx) {
  const startIndex = appState.currentPage * NAMES_PER_PAGE;
  const endIndex = Math.min(startIndex + NAMES_PER_PAGE, appState.names.length);
  
  for (let i = startIndex; i < endIndex; i++) {
    const textData = appState.cache[i];
    if (!textData) continue;
    
    const x = textData.x * appState.canvasScale;
    const y = textData.y * appState.canvasScale;
    const fontSize = textData.fontSize * appState.canvasScale;
    const letterSpacing = textData.letterSpacing * appState.canvasScale;
    
    // Draw text
    ctx.save();
    ctx.font = `${fontSize}px ${appState.customFont ? appState.customFontName : 'Arial'}`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const lines = textData.text.split('\n');
    const lineHeight = fontSize * 1.2;
    const totalHeight = lines.length * lineHeight;
    const startY = y - totalHeight / 2 + lineHeight / 2;
    
    lines.forEach((line, lineIndex) => {
      if (letterSpacing !== 0) {
        drawTextWithLetterSpacing(ctx, line, x, startY + lineIndex * lineHeight, letterSpacing);
      } else {
        ctx.fillText(line, x, startY + lineIndex * lineHeight);
      }
    });
    
    // Draw selection box if selected
    if (appState.selectedTextIndex === i) {
      ctx.strokeStyle = '#32b8c6';
      ctx.lineWidth = 2;
      const textWidth = Math.max(...lines.map(line => ctx.measureText(line).width + letterSpacing * (line.length - 1)));
      const padding = 10;
      ctx.strokeRect(
        x - textWidth / 2 - padding,
        y - totalHeight / 2 - padding,
        textWidth + padding * 2,
        totalHeight + padding * 2
      );
    }
    
    ctx.restore();
  }
}

function drawTextWithLetterSpacing(ctx, text, x, y, letterSpacing) {
  const chars = text.split('');
  let totalWidth = 0;
  
  chars.forEach(char => {
    totalWidth += ctx.measureText(char).width + letterSpacing;
  });
  totalWidth -= letterSpacing;
  
  let currentX = x - totalWidth / 2;
  
  chars.forEach(char => {
    ctx.fillText(char, currentX, y);
    currentX += ctx.measureText(char).width + letterSpacing;
  });
}

// Canvas Mouse Events
elements.editorCanvas.addEventListener('mousedown', (e) => {
  const rect = elements.editorCanvas.getBoundingClientRect();
  const mouseX = (e.clientX - rect.left) / appState.canvasScale;
  const mouseY = (e.clientY - rect.top) / appState.canvasScale;
  
  const clickedIndex = getTextIndexAtPosition(mouseX, mouseY);
  
  if (clickedIndex !== null) {
    appState.selectedTextIndex = clickedIndex;
    appState.isDragging = true;
    
    const textData = appState.cache[clickedIndex];
    appState.dragOffset = {
      x: mouseX - textData.x,
      y: mouseY - textData.y
    };
    
    updateTextControls();
    renderCanvas();
  } else {
    appState.selectedTextIndex = null;
    updateTextControls();
    renderCanvas();
  }
});

elements.editorCanvas.addEventListener('mousemove', (e) => {
  if (appState.isDragging && appState.selectedTextIndex !== null) {
    const rect = elements.editorCanvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / appState.canvasScale;
    const mouseY = (e.clientY - rect.top) / appState.canvasScale;
    
    const textData = appState.cache[appState.selectedTextIndex];
    textData.x = mouseX - appState.dragOffset.x;
    textData.y = mouseY - appState.dragOffset.y;
    
    // Clamp to canvas bounds
    textData.x = Math.max(0, Math.min(PDF_WIDTH, textData.x));
    textData.y = Math.max(0, Math.min(PDF_HEIGHT, textData.y));
    
    renderCanvas();
  }
});

elements.editorCanvas.addEventListener('mouseup', () => {
  appState.isDragging = false;
});

elements.editorCanvas.addEventListener('dblclick', (e) => {
  const rect = elements.editorCanvas.getBoundingClientRect();
  const mouseX = (e.clientX - rect.left) / appState.canvasScale;
  const mouseY = (e.clientY - rect.top) / appState.canvasScale;
  
  const clickedIndex = getTextIndexAtPosition(mouseX, mouseY);
  
  if (clickedIndex !== null) {
    appState.selectedTextIndex = clickedIndex;
    updateTextControls();
    elements.textContentInput.focus();
    elements.textContentInput.select();
  }
});

function getTextIndexAtPosition(x, y) {
  const startIndex = appState.currentPage * NAMES_PER_PAGE;
  const endIndex = Math.min(startIndex + NAMES_PER_PAGE, appState.names.length);
  
  for (let i = endIndex - 1; i >= startIndex; i--) {
    const textData = appState.cache[i];
    if (!textData) continue;
    
    const ctx = elements.editorCanvas.getContext('2d');
    const fontSize = textData.fontSize;
    ctx.font = `${fontSize}px ${appState.customFont ? appState.customFontName : 'Arial'}`;
    
    const lines = textData.text.split('\n');
    const lineHeight = fontSize * 1.2;
    const totalHeight = lines.length * lineHeight;
    const textWidth = Math.max(...lines.map(line => ctx.measureText(line).width + textData.letterSpacing * (line.length - 1)));
    
    const padding = 10;
    const left = textData.x - textWidth / 2 - padding;
    const top = textData.y - totalHeight / 2 - padding;
    const width = textWidth + padding * 2;
    const height = totalHeight + padding * 2;
    
    if (x >= left && x <= left + width && y >= top && y <= top + height) {
      return i;
    }
  }
  
  return null;
}

// Text Controls
function updateTextControls() {
  if (appState.selectedTextIndex !== null) {
    const textData = appState.cache[appState.selectedTextIndex];
    elements.textContentInput.value = textData.text.replace('\n', ' ');
    elements.fontSizeSlider.value = textData.fontSize;
    elements.fontSizeValue.textContent = textData.fontSize;
    elements.letterSpacingSlider.value = textData.letterSpacing;
    elements.letterSpacingValue.textContent = textData.letterSpacing;
    elements.textContentInput.disabled = false;
    elements.fontSizeSlider.disabled = false;
    elements.letterSpacingSlider.disabled = false;
    elements.centerTextBtn.disabled = false;
  } else {
    elements.textContentInput.value = '';
    elements.textContentInput.placeholder = 'Select a name first';
    elements.textContentInput.disabled = true;
    elements.fontSizeSlider.disabled = true;
    elements.letterSpacingSlider.disabled = true;
    elements.centerTextBtn.disabled = true;
  }
}

elements.textContentInput.addEventListener('input', (e) => {
  if (appState.selectedTextIndex !== null) {
    const parts = e.target.value.split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    appState.cache[appState.selectedTextIndex].text = `${firstName}\n${lastName}`;
    renderCanvas();
  }
});

elements.fontSizeSlider.addEventListener('input', (e) => {
  if (appState.selectedTextIndex !== null) {
    const fontSize = parseInt(e.target.value);
    appState.cache[appState.selectedTextIndex].fontSize = fontSize;
    elements.fontSizeValue.textContent = fontSize;
    renderCanvas();
  }
});

elements.letterSpacingSlider.addEventListener('input', (e) => {
  if (appState.selectedTextIndex !== null) {
    const letterSpacing = parseInt(e.target.value);
    appState.cache[appState.selectedTextIndex].letterSpacing = letterSpacing;
    elements.letterSpacingValue.textContent = letterSpacing;
    renderCanvas();
  }
});

elements.centerTextBtn.addEventListener('click', () => {
  if (appState.selectedTextIndex !== null) {
    const quadrantIndex = appState.selectedTextIndex % 4;
    const center = QUADRANT_CENTERS[quadrantIndex];
    appState.cache[appState.selectedTextIndex].x = center.x;
    appState.cache[appState.selectedTextIndex].y = center.y;
    renderCanvas();
  }
});

// Pagination
function updatePagination() {
  const totalPages = Math.ceil(appState.names.length / NAMES_PER_PAGE);
  elements.pageInfo.textContent = `Page ${appState.currentPage + 1} of ${totalPages}`;
  elements.prevPageBtn.disabled = appState.currentPage === 0;
  elements.nextPageBtn.disabled = appState.currentPage >= totalPages - 1;
}

elements.prevPageBtn.addEventListener('click', () => {
  if (appState.currentPage > 0) {
    appState.currentPage--;
    appState.selectedTextIndex = null;
    updateTextControls();
    updatePagination();
    renderCanvas();
  }
});

elements.nextPageBtn.addEventListener('click', () => {
  const totalPages = Math.ceil(appState.names.length / NAMES_PER_PAGE);
  if (appState.currentPage < totalPages - 1) {
    appState.currentPage++;
    appState.selectedTextIndex = null;
    updateTextControls();
    updatePagination();
    renderCanvas();
  }
});

// Generate PDF
elements.generatePdfBtn.addEventListener('click', async () => {
  showLoading('Generating PDF...');
  
  try {
    await generateFinalPDF();
    hideLoading();
  } catch (error) {
    hideLoading();
    showError('Error generating PDF: ' + error.message);
  }
});

async function generateFinalPDF() {
  const { PDFDocument, rgb } = PDFLib;
  
  // Create new PDF document
  const pdfDoc = await PDFDocument.create();
  
  // Embed font
  let font;
  if (appState.customFont) {
    try {
      font = await pdfDoc.embedFont(appState.customFont);
    } catch (error) {
      console.error('Error embedding custom font, using standard font:', error);
      font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    }
  } else {
    font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
  }
  
  // Load template PDF
  const templatePdfDoc = await PDFDocument.load(appState.pdfTemplateData);
  
  // Calculate number of pages
  const totalPages = Math.ceil(appState.names.length / NAMES_PER_PAGE);
  
  // Generate each page
  for (let pageNum = 0; pageNum < totalPages; pageNum++) {
    // Copy template page
    const [templatePage] = await pdfDoc.copyPages(templatePdfDoc, [0]);
    const page = pdfDoc.addPage(templatePage);
    
    const startIndex = pageNum * NAMES_PER_PAGE;
    const endIndex = Math.min(startIndex + NAMES_PER_PAGE, appState.names.length);
    
    // Draw text for each name on this page
    for (let i = startIndex; i < endIndex; i++) {
      const textData = appState.cache[i];
      if (!textData) continue;
      
      const lines = textData.text.split('\n');
      const fontSize = textData.fontSize;
      const lineHeight = fontSize * 1.2;
      const totalHeight = lines.length * lineHeight;
      
      lines.forEach((line, lineIndex) => {
        const y = PDF_HEIGHT - (textData.y - totalHeight / 2 + lineIndex * lineHeight + lineHeight / 2);
        
        if (textData.letterSpacing !== 0) {
          // Draw with letter spacing
          let currentX = textData.x;
          const chars = line.split('');
          let totalWidth = 0;
          
          chars.forEach(char => {
            totalWidth += font.widthOfTextAtSize(char, fontSize) + textData.letterSpacing;
          });
          totalWidth -= textData.letterSpacing;
          
          currentX = textData.x - totalWidth / 2;
          
          chars.forEach(char => {
            page.drawText(char, {
              x: currentX,
              y: y,
              size: fontSize,
              font: font,
              color: rgb(0, 0, 0)
            });
            currentX += font.widthOfTextAtSize(char, fontSize) + textData.letterSpacing;
          });
        } else {
          // Draw without letter spacing
          const textWidth = font.widthOfTextAtSize(line, fontSize);
          page.drawText(line, {
            x: textData.x - textWidth / 2,
            y: y,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0)
          });
        }
      });
    }
  }
  
  // Save and download
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = 'namecards.pdf';
  link.click();
  
  URL.revokeObjectURL(url);
}

// Initialize
updateTextControls();