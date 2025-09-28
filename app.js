class NamecardGenerator {
    constructor() {
        this.csvData = [];
        this.pdfTemplate = null;
        this.customFont = null;
        this.customFontFile = null;
        this.generatedPdf = null;
        this.namePositions = [];
        this.isDeveloperMode = false;
        this.draggedElement = null;
        this.dragOffset = { x: 0, y: 0 };
        
        // A4 dimensions and sections from provided data
        this.a4Dimensions = {
            width: 595.28,
            height: 841.89,
            sections: [
                { id: "top-left", x: 0, y: 420.945, width: 297.64, height: 420.945, centerX: 148.82, centerY: 631.4175 },
                { id: "top-right", x: 297.64, y: 420.945, width: 297.64, height: 420.945, centerX: 446.46, centerY: 631.4175 },
                { id: "bottom-left", x: 0, y: 0, width: 297.64, height: 420.945, centerX: 148.82, centerY: 210.4725 },
                { id: "bottom-right", x: 297.64, y: 0, width: 297.64, height: 420.945, centerX: 446.46, centerY: 210.4725 }
            ]
        };
        
        this.textFormatting = {
            fontSize: 18,
            fontColor: [0, 0, 0],
            lineHeight: 1.2
        };
        
        this.initializeEventListeners();
        this.updateSteps(); // Initialize step states
    }
    
    initializeEventListeners() {
        // File input direct event listeners
        document.getElementById('csv-file').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleCsvUpload(e.target.files[0]);
            }
        });
        
        document.getElementById('pdf-file').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handlePdfUpload(e.target.files[0]);
            }
        });
        
        document.getElementById('font-file').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFontUpload(e.target.files[0]);
            }
        });
        
        // Upload area click handlers
        document.getElementById('csv-upload-area').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('csv-file').click();
        });
        
        document.getElementById('pdf-upload-area').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('pdf-file').click();
        });
        
        document.getElementById('font-upload-area').addEventListener('click', (e) => {
            e.preventDefault();
            if (this.csvData.length > 0 && this.pdfTemplate) {
                document.getElementById('font-file').click();
            }
        });
        
        // Drag and drop for each upload area
        this.setupDragAndDrop('csv-upload-area', this.handleCsvUpload.bind(this));
        this.setupDragAndDrop('pdf-upload-area', this.handlePdfUpload.bind(this));
        this.setupDragAndDrop('font-upload-area', this.handleFontUpload.bind(this));
        
        // Developer mode toggle
        const devModeCheckbox = document.getElementById('dev-mode-checkbox');
        devModeCheckbox.addEventListener('change', (e) => {
            this.toggleDeveloperMode(e.target.checked);
        });
        
        // Buttons
        document.getElementById('generate-btn').addEventListener('click', (e) => {
            if (!e.target.disabled) {
                this.generateNamecards();
            }
        });
        
        document.getElementById('download-btn').addEventListener('click', this.downloadPdf.bind(this));
        document.getElementById('reset-positions-btn').addEventListener('click', this.resetAllPositions.bind(this));
        
        // Mouse events for dragging
        document.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }
    
    setupDragAndDrop(areaId, handler) {
        const uploadArea = document.getElementById(areaId);
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            if (e.dataTransfer.files.length > 0) {
                // Check if it's font upload and prerequisites aren't met
                if (areaId === 'font-upload-area' && (!this.csvData.length || !this.pdfTemplate)) {
                    return;
                }
                handler(e.dataTransfer.files[0]);
            }
        });
    }
    
    handleCsvUpload(file) {
        const statusEl = document.getElementById('csv-status');
        const uploadArea = document.getElementById('csv-upload-area');
        
        if (!file.name.toLowerCase().endsWith('.csv')) {
            this.showStatus(statusEl, 'Please select a valid CSV file', 'error');
            return;
        }
        
        this.showStatus(statusEl, 'Processing CSV file...', 'processing');
        
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.errors.length > 0) {
                    this.showStatus(statusEl, 'Error parsing CSV: ' + results.errors[0].message, 'error');
                    return;
                }
                
                const data = results.data;
                if (data.length === 0) {
                    this.showStatus(statusEl, 'CSV file is empty', 'error');
                    return;
                }
                
                const firstRow = data[0];
                if (!firstRow.hasOwnProperty('Name') || !firstRow.hasOwnProperty('Surname')) {
                    this.showStatus(statusEl, 'CSV must contain "Name" and "Surname" columns', 'error');
                    return;
                }
                
                this.csvData = data.filter(row => row.Name && row.Surname);
                
                if (this.csvData.length === 0) {
                    this.showStatus(statusEl, 'No valid name entries found in CSV', 'error');
                    return;
                }
                
                uploadArea.classList.add('has-file');
                this.showStatus(statusEl, `Successfully loaded ${this.csvData.length} names`, 'success');
                this.initializeNamePositions();
                this.updateSteps();
            },
            error: (error) => {
                this.showStatus(statusEl, 'Error reading CSV file: ' + error.message, 'error');
            }
        });
    }
    
    handlePdfUpload(file) {
        const statusEl = document.getElementById('pdf-status');
        const uploadArea = document.getElementById('pdf-upload-area');
        
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            this.showStatus(statusEl, 'Please select a valid PDF file', 'error');
            return;
        }
        
        this.showStatus(statusEl, 'Loading PDF template...', 'processing');
        
        const reader = new FileReader();
        reader.onload = (e) => {
            this.pdfTemplate = e.target.result;
            uploadArea.classList.add('has-file');
            this.showStatus(statusEl, 'PDF template loaded successfully', 'success');
            this.updateSteps();
        };
        
        reader.onerror = () => {
            this.showStatus(statusEl, 'Error reading PDF file', 'error');
        };
        
        reader.readAsArrayBuffer(file);
    }
    
    handleFontUpload(file) {
        // Check prerequisites
        if (!this.csvData.length || !this.pdfTemplate) {
            return;
        }
        
        const statusEl = document.getElementById('font-status');
        const uploadArea = document.getElementById('font-upload-area');
        const fontPreview = document.getElementById('font-preview');
        const fontPreviewText = document.getElementById('font-preview-text');
        
        const validExtensions = ['.ttf', '.otf', '.woff', '.woff2'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        
        if (!validExtensions.includes(fileExtension)) {
            this.showStatus(statusEl, 'Please select a valid font file (.ttf, .otf, .woff, .woff2)', 'error');
            return;
        }
        
        this.showStatus(statusEl, 'Loading font file...', 'processing');
        
        const reader = new FileReader();
        reader.onload = (e) => {
            this.customFontFile = file;
            uploadArea.classList.add('has-file');
            this.showStatus(statusEl, `Font "${file.name}" loaded successfully`, 'success');
            
            // Show font preview
            const fontUrl = URL.createObjectURL(file);
            const fontFace = new FontFace('CustomFont', `url(${fontUrl})`);
            
            fontFace.load().then(() => {
                document.fonts.add(fontFace);
                fontPreviewText.style.fontFamily = 'CustomFont, sans-serif';
                fontPreview.style.display = 'block';
            }).catch(() => {
                console.warn('Could not preview font, but will still use for PDF generation');
                fontPreview.style.display = 'block';
                fontPreviewText.style.fontFamily = 'sans-serif';
            });
        };
        
        reader.onerror = () => {
            this.showStatus(statusEl, 'Error reading font file', 'error');
        };
        
        reader.readAsArrayBuffer(file);
    }
    
    initializeNamePositions() {
        this.namePositions = this.csvData.map((person, index) => {
            const sectionIndex = index % 4;
            const section = this.a4Dimensions.sections[sectionIndex];
            return {
                name: person.Name,
                surname: person.Surname,
                x: section.centerX,
                y: section.centerY,
                sectionIndex: sectionIndex
            };
        });
    }
    
    updateSteps() {
        const hasBasicFiles = this.csvData.length > 0 && this.pdfTemplate;
        
        // Font step (Step 3)
        const fontStep = document.getElementById('font-step');
        const fontPlaceholder = document.getElementById('font-placeholder');
        
        if (hasBasicFiles) {
            fontStep.classList.remove('step--disabled');
            fontStep.classList.add('step--active');
            fontPlaceholder.style.display = 'none';
        } else {
            fontStep.classList.add('step--disabled');
            fontStep.classList.remove('step--active');
            fontPlaceholder.style.display = 'block';
        }
        
        // Preview step (Step 4)
        if (hasBasicFiles) {
            this.activatePreviewStep();
        }
        
        // Generate step (Step 5)
        this.updateGenerateButton();
    }
    
    activatePreviewStep() {
        const previewStep = document.getElementById('preview-step');
        const previewContent = document.getElementById('preview-content');
        const nameCount = document.getElementById('name-count');
        
        previewStep.classList.remove('step--disabled');
        previewStep.classList.add('step--active');
        previewContent.style.display = 'block';
        nameCount.textContent = this.csvData.length;
        
        this.createInteractivePreview();
        this.updatePreviewTable();
    }
    
    createInteractivePreview() {
        const nameBlocksContainer = document.getElementById('name-blocks');
        nameBlocksContainer.innerHTML = '';
        
        this.namePositions.forEach((position, index) => {
            const nameBlock = document.createElement('div');
            nameBlock.className = 'name-block';
            nameBlock.dataset.index = index;
            nameBlock.innerHTML = `${position.name}<br>${position.surname}`;
            
            // Convert PDF coordinates to preview coordinates
            const previewCoords = this.pdfToPreviewCoords(position.x, position.y);
            nameBlock.style.left = previewCoords.x + 'px';
            nameBlock.style.top = previewCoords.y + 'px';
            
            nameBlocksContainer.appendChild(nameBlock);
        });
    }
    
    updatePreviewTable() {
        const tbody = document.getElementById('preview-tbody');
        tbody.innerHTML = '';
        
        this.namePositions.forEach((position, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${position.name}</td>
                <td>${position.surname}</td>
                <td class="coords-column" style="${this.isDeveloperMode ? '' : 'display: none;'}">${position.x.toFixed(1)}, ${position.y.toFixed(1)}</td>
            `;
            tbody.appendChild(row);
        });
    }
    
    pdfToPreviewCoords(pdfX, pdfY) {
        const preview = document.getElementById('pdf-preview');
        
        const scaleX = preview.offsetWidth / this.a4Dimensions.width;
        const scaleY = preview.offsetHeight / this.a4Dimensions.height;
        
        return {
            x: (pdfX * scaleX) - 50, // -50 to center the block
            y: preview.offsetHeight - (pdfY * scaleY) - 25 // Flip Y and center
        };
    }
    
    previewToPdfCoords(previewX, previewY) {
        const preview = document.getElementById('pdf-preview');
        
        const scaleX = this.a4Dimensions.width / preview.offsetWidth;
        const scaleY = this.a4Dimensions.height / preview.offsetHeight;
        
        return {
            x: (previewX + 50) * scaleX, // +50 to account for centering
            y: (preview.offsetHeight - previewY - 25) * scaleY // Flip Y and account for centering
        };
    }
    
    handleMouseDown(e) {
        if (e.target.classList.contains('name-block')) {
            this.draggedElement = e.target;
            this.draggedElement.classList.add('dragging');
            
            const rect = this.draggedElement.getBoundingClientRect();
            const previewRect = document.getElementById('pdf-preview').getBoundingClientRect();
            
            this.dragOffset = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            
            e.preventDefault();
        }
    }
    
    handleMouseMove(e) {
        if (this.draggedElement) {
            const previewRect = document.getElementById('pdf-preview').getBoundingClientRect();
            
            let newX = e.clientX - previewRect.left - this.dragOffset.x;
            let newY = e.clientY - previewRect.top - this.dragOffset.y;
            
            // Constrain to preview area
            const preview = document.getElementById('pdf-preview');
            newX = Math.max(0, Math.min(newX, preview.offsetWidth - this.draggedElement.offsetWidth));
            newY = Math.max(0, Math.min(newY, preview.offsetHeight - this.draggedElement.offsetHeight));
            
            this.draggedElement.style.left = newX + 'px';
            this.draggedElement.style.top = newY + 'px';
            
            // Update coordinates display
            if (this.isDeveloperMode) {
                const pdfCoords = this.previewToPdfCoords(newX, newY);
                const coordsDisplay = document.getElementById('current-coordinates');
                coordsDisplay.textContent = `${pdfCoords.x.toFixed(1)}, ${pdfCoords.y.toFixed(1)}`;
            }
            
            // Check if within correct section bounds
            const index = parseInt(this.draggedElement.dataset.index);
            const sectionIndex = index % 4;
            this.checkSectionBounds(newX, newY, sectionIndex);
        }
    }
    
    handleMouseUp(e) {
        if (this.draggedElement) {
            this.draggedElement.classList.remove('dragging');
            
            // Update position data
            const index = parseInt(this.draggedElement.dataset.index);
            const rect = this.draggedElement.getBoundingClientRect();
            const previewRect = document.getElementById('pdf-preview').getBoundingClientRect();
            
            const previewX = rect.left - previewRect.left;
            const previewY = rect.top - previewRect.top;
            const pdfCoords = this.previewToPdfCoords(previewX, previewY);
            
            this.namePositions[index].x = pdfCoords.x;
            this.namePositions[index].y = pdfCoords.y;
            
            this.updatePreviewTable();
            this.draggedElement = null;
            
            // Clear coordinates display
            if (this.isDeveloperMode) {
                const coordsDisplay = document.getElementById('current-coordinates');
                coordsDisplay.textContent = '-';
            }
        }
    }
    
    checkSectionBounds(previewX, previewY, expectedSectionIndex) {
        const preview = document.getElementById('pdf-preview');
        const sectionWidth = preview.offsetWidth / 2;
        const sectionHeight = preview.offsetHeight / 2;
        
        let actualSectionIndex;
        if (previewX < sectionWidth && previewY < sectionHeight) {
            actualSectionIndex = 0; // top-left
        } else if (previewX >= sectionWidth && previewY < sectionHeight) {
            actualSectionIndex = 1; // top-right
        } else if (previewX < sectionWidth && previewY >= sectionHeight) {
            actualSectionIndex = 2; // bottom-left
        } else {
            actualSectionIndex = 3; // bottom-right
        }
        
        if (actualSectionIndex !== expectedSectionIndex) {
            this.draggedElement.classList.add('out-of-bounds');
        } else {
            this.draggedElement.classList.remove('out-of-bounds');
        }
    }
    
    resetAllPositions() {
        this.initializeNamePositions();
        this.createInteractivePreview();
        this.updatePreviewTable();
    }
    
    toggleDeveloperMode(isEnabled) {
        this.isDeveloperMode = isEnabled;
        
        if (this.isDeveloperMode) {
            document.body.classList.add('dev-mode');
        } else {
            document.body.classList.remove('dev-mode');
        }
        
        // Update table visibility
        const coordsCols = document.querySelectorAll('.coords-column');
        coordsCols.forEach(col => {
            col.style.display = this.isDeveloperMode ? 'table-cell' : 'none';
        });
        
        // Update coordinates display
        const coordsDisplay = document.getElementById('coordinates-display');
        coordsDisplay.style.display = this.isDeveloperMode ? 'flex' : 'none';
    }
    
    updateGenerateButton() {
        const generateBtn = document.getElementById('generate-btn');
        const generateStep = document.getElementById('generate-step');
        const generatePlaceholder = document.getElementById('generate-placeholder');
        
        const isReady = this.csvData.length > 0 && this.pdfTemplate;
        
        generateBtn.disabled = !isReady;
        
        if (isReady) {
            generateStep.classList.remove('step--disabled');
            generateStep.classList.add('step--active');
            generatePlaceholder.style.display = 'none';
        } else {
            generateStep.classList.add('step--disabled');
            generateStep.classList.remove('step--active');
            generatePlaceholder.style.display = 'block';
        }
    }
    
    async generateNamecards() {
        // Double-check readiness
        if (!this.csvData.length || !this.pdfTemplate) {
            return;
        }
        
        const loadingOverlay = document.getElementById('loading-overlay');
        const generateStatus = document.getElementById('generate-status');
        
        try {
            loadingOverlay.style.display = 'flex';
            this.showGenerateStatus(generateStatus, 'Generating namecards...', 'processing');
            
            const { PDFDocument, rgb, StandardFonts } = PDFLib;
            
            const templatePdf = await PDFDocument.load(this.pdfTemplate);
            const pdfDoc = await PDFDocument.create();
            
            // Embed font
            let font;
            if (this.customFontFile) {
                try {
                    const fontBytes = await this.customFontFile.arrayBuffer();
                    font = await pdfDoc.embedFont(fontBytes);
                } catch (error) {
                    console.warn('Failed to embed custom font, using Helvetica:', error);
                    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
                }
            } else {
                font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            }
            
            // Process names in groups of 4 (one page)
            for (let i = 0; i < this.csvData.length; i += 4) {
                const [copiedPage] = await pdfDoc.copyPages(templatePdf, [0]);
                const page = pdfDoc.addPage(copiedPage);
                
                for (let j = 0; j < 4 && i + j < this.csvData.length; j++) {
                    const positionIndex = i + j;
                    const position = this.namePositions[positionIndex];
                    
                    await this.addNameToSection(page, position, font);
                }
            }
            
            this.generatedPdf = await pdfDoc.save();
            
            loadingOverlay.style.display = 'none';
            this.showGenerateStatus(generateStatus, 'Namecards generated successfully!', 'success');
            this.showDownloadStep();
            
        } catch (error) {
            loadingOverlay.style.display = 'none';
            this.showGenerateStatus(generateStatus, 'Error generating namecards: ' + error.message, 'error');
            console.error('Generation error:', error);
        }
    }
    
    async addNameToSection(page, position, font) {
        const { fontSize } = this.textFormatting;
        const text = `${position.name}\n${position.surname}`;
        
        const lines = text.split('\n');
        const lineHeight = fontSize * this.textFormatting.lineHeight;
        const totalTextHeight = lines.length * lineHeight;
        
        let yPosition = position.y + (totalTextHeight / 2) - lineHeight;
        
        lines.forEach((line) => {
            const textWidth = font.widthOfTextAtSize(line, fontSize);
            const xPosition = position.x - (textWidth / 2);
            
            page.drawText(line, {
                x: xPosition,
                y: yPosition,
                size: fontSize,
                font: font,
                color: rgb(...this.textFormatting.fontColor),
            });
            
            yPosition -= lineHeight;
        });
    }
    
    showStatus(element, message, type) {
        element.textContent = message;
        element.className = `upload-status ${type}`;
        element.style.display = 'block';
    }
    
    showGenerateStatus(element, message, type) {
        element.textContent = message;
        element.className = `generate-status ${type}`;
        element.style.display = 'block';
    }
    
    showDownloadStep() {
        const downloadStep = document.getElementById('download-step');
        downloadStep.style.display = 'block';
    }
    
    downloadPdf() {
        if (!this.generatedPdf) {
            alert('No PDF generated yet');
            return;
        }
        
        const blob = new Blob([this.generatedPdf], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'namecards.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new NamecardGenerator();
});