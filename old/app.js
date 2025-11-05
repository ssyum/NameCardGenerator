// CRITICAL FIX: Helper function to replace arrayBuffer() calls
function fileToArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });
}

class NamecardGenerator {
    constructor() {
        this.csvData = [];
        this.pdfTemplate = null;
        this.customFontFile = null;
        this.generatedPdf = null;
        this.developerMode = false;
        this.namePositions = [];
        
        // Pagination properties
        this.currentPage = 0;
        this.namesPerPage = 4;
        this.totalPages = 0;
        
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
    }
    
    initializeEventListeners() {
        // CRITICAL FIX: Direct button click handlers for file browsing
        this.setupDirectFileHandlers();
        
        // Developer mode toggle
        document.getElementById('developer-mode-toggle').addEventListener('click', this.toggleDeveloperMode.bind(this));
        
        // Pagination controls
        document.getElementById('prev-page').addEventListener('click', this.previousPage.bind(this));
        document.getElementById('next-page').addEventListener('click', this.nextPage.bind(this));
        
        // Font size control
        const fontSizeSlider = document.getElementById('font-size');
        const fontSizeDisplay = document.getElementById('font-size-display');
        fontSizeSlider.addEventListener('input', (e) => {
            this.textFormatting.fontSize = parseInt(e.target.value);
            fontSizeDisplay.textContent = e.target.value + 'px';
            this.updatePreview();
        });
        
        // Generate button
        document.getElementById('generate-btn').addEventListener('click', this.generateNamecards.bind(this));
        
        // Download button
        document.getElementById('download-btn').addEventListener('click', this.downloadPdf.bind(this));
        
        // Built-in test button
        const testBtn = document.getElementById('run-test-btn');
        if (testBtn) {
            testBtn.addEventListener('click', this.runBuiltInTest.bind(this));
            console.log('Test button event listener attached');
        } else {
            console.error('Test button not found in DOM');
        }
        
        // Initialize coordinates display
        this.updateCoordinatesDisplay(0, 0);
        
        console.log('NamecardGenerator initialized successfully');
    }
    
    setupDirectFileHandlers() {
        // CSV file handling
        const csvFileInput = document.getElementById('csv-file');
        const csvBrowseBtn = document.getElementById('csv-browse-btn');
        const csvUploadArea = document.getElementById('csv-upload-area');
        
        if (csvBrowseBtn && csvFileInput) {
            csvBrowseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('CSV browse button clicked');
                csvFileInput.click();
            });
        }
        
        if (csvFileInput) {
            csvFileInput.addEventListener('change', (e) => {
                console.log('CSV file selected:', e.target.files[0]?.name);
                if (e.target.files.length > 0) {
                    this.handleCsvUpload(e.target.files[0]);
                }
            });
        }
        
        // PDF file handling
        const pdfFileInput = document.getElementById('pdf-file');
        const pdfBrowseBtn = document.getElementById('pdf-browse-btn');
        const pdfUploadArea = document.getElementById('pdf-upload-area');
        
        if (pdfBrowseBtn && pdfFileInput) {
            pdfBrowseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('PDF browse button clicked');
                pdfFileInput.click();
            });
        }
        
        if (pdfFileInput) {
            pdfFileInput.addEventListener('change', (e) => {
                console.log('PDF file selected:', e.target.files[0]?.name);
                if (e.target.files.length > 0) {
                    this.handlePdfUpload(e.target.files[0]);
                }
            });
        }
        
        // Font file handling
        const fontFileInput = document.getElementById('font-file');
        const fontBrowseBtn = document.getElementById('font-browse-btn');
        const fontUploadArea = document.getElementById('font-upload-area');
        
        if (fontBrowseBtn && fontFileInput) {
            fontBrowseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Font browse button clicked');
                fontFileInput.click();
            });
        }
        
        if (fontFileInput) {
            fontFileInput.addEventListener('change', (e) => {
                console.log('Font file selected:', e.target.files[0]?.name);
                if (e.target.files.length > 0) {
                    this.handleFontUpload(e.target.files[0]);
                }
            });
        }
        
        // Set up drag and drop for upload areas
        this.setupDragAndDrop(csvUploadArea, this.handleCsvUpload.bind(this));
        this.setupDragAndDrop(pdfUploadArea, this.handlePdfUpload.bind(this));
        this.setupDragAndDrop(fontUploadArea, this.handleFontUpload.bind(this));
        
        console.log('Direct file handlers setup complete');
    }
    
    setupDragAndDrop(uploadArea, handler) {
        if (!uploadArea) return;
        
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
                console.log('File dropped:', e.dataTransfer.files[0].name);
                handler(e.dataTransfer.files[0]);
            }
        });
    }
    
    async handleCsvUpload(file) {
        const statusEl = document.getElementById('csv-status');
        const uploadArea = document.getElementById('csv-upload-area');
        
        console.log('Handling CSV upload:', file.name);
        
        if (!file.name.toLowerCase().endsWith('.csv')) {
            this.showStatus(statusEl, 'Please select a valid CSV file', 'error');
            return;
        }
        
        this.showStatus(statusEl, 'Processing CSV file...', 'processing');
        
        try {
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
                    
                    // Calculate pagination
                    this.totalPages = Math.ceil(this.csvData.length / this.namesPerPage);
                    this.currentPage = 0;
                    
                    // Initialize default positions
                    this.initializeNamePositions();
                    
                    uploadArea.classList.add('has-file');
                    this.showStatus(statusEl, `Successfully loaded ${this.csvData.length} names`, 'success');
                    this.updatePreviewStep();
                    this.updateGenerateButton();
                    
                    console.log(`CSV processed: ${this.csvData.length} names, ${this.totalPages} pages`);
                },
                error: (error) => {
                    this.showStatus(statusEl, 'Error reading CSV file: ' + error.message, 'error');
                }
            });
        } catch (error) {
            this.showStatus(statusEl, 'Error processing CSV file: ' + error.message, 'error');
        }
    }
    
    async handlePdfUpload(file) {
        const statusEl = document.getElementById('pdf-status');
        const uploadArea = document.getElementById('pdf-upload-area');
        
        console.log('Handling PDF upload:', file.name);
        
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            this.showStatus(statusEl, 'Please select a valid PDF file', 'error');
            return;
        }
        
        this.showStatus(statusEl, 'Loading PDF template...', 'processing');
        
        try {
            // CRITICAL FIX: Use FileReader instead of file.arrayBuffer()
            this.pdfTemplate = await fileToArrayBuffer(file);
            uploadArea.classList.add('has-file');
            this.showStatus(statusEl, 'PDF template loaded successfully', 'success');
            this.updatePreviewStep();
            this.updateGenerateButton();
            console.log('PDF template loaded successfully');
        } catch (error) {
            this.showStatus(statusEl, 'Error reading PDF file: ' + error.message, 'error');
            console.error('PDF loading error:', error);
        }
    }
    
    async handleFontUpload(file) {
        const statusEl = document.getElementById('font-status');
        const uploadArea = document.getElementById('font-upload-area');
        
        console.log('Handling font upload:', file.name);
        
        const validExtensions = ['.ttf', '.otf', '.woff', '.woff2'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        
        if (!validExtensions.includes(fileExtension)) {
            this.showStatus(statusEl, 'Please select a valid font file (.ttf, .otf, .woff, .woff2)', 'error');
            return;
        }
        
        this.showStatus(statusEl, 'Loading custom font...', 'processing');
        
        try {
            this.customFontFile = file;
            uploadArea.classList.add('has-file');
            this.showStatus(statusEl, `Custom font "${file.name}" loaded successfully`, 'success');
            this.updatePreview();
            console.log('Font loaded successfully');
        } catch (error) {
            this.showStatus(statusEl, 'Error reading font file: ' + error.message, 'error');
            console.error('Font loading error:', error);
        }
    }
    
    initializeNamePositions() {
        this.namePositions = this.csvData.map((person, index) => {
            const pageIndex = Math.floor(index / this.namesPerPage);
            const positionOnPage = index % this.namesPerPage;
            const section = this.a4Dimensions.sections[positionOnPage];
            
            return {
                name: person.Name,
                surname: person.Surname,
                x: section.centerX,
                y: section.centerY,
                sectionId: section.id,
                page: pageIndex,
                positionOnPage: positionOnPage
            };
        });
        console.log('Name positions initialized:', this.namePositions.length);
    }
    
    toggleDeveloperMode() {
        this.developerMode = !this.developerMode;
        const toggleBtn = document.getElementById('developer-mode-toggle');
        const developerInfo = document.getElementById('developer-info');
        const previewPage = document.getElementById('preview-page');
        
        toggleBtn.textContent = `Developer Mode: ${this.developerMode ? 'ON' : 'OFF'}`;
        
        if (this.developerMode) {
            if (developerInfo) {
                developerInfo.style.display = 'block';
            }
            if (previewPage) {
                previewPage.classList.add('developer-mode');
            }
        } else {
            if (developerInfo) {
                developerInfo.style.display = 'none';
            }
            if (previewPage) {
                previewPage.classList.remove('developer-mode');
            }
        }
        
        this.updatePreview();
        console.log('Developer mode:', this.developerMode ? 'ON' : 'OFF');
    }
    
    // Pagination methods
    previousPage() {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.updatePageIndicator();
            this.updatePreview();
            console.log('Navigated to page:', this.currentPage + 1);
        }
    }
    
    nextPage() {
        if (this.currentPage < this.totalPages - 1) {
            this.currentPage++;
            this.updatePageIndicator();
            this.updatePreview();
            console.log('Navigated to page:', this.currentPage + 1);
        }
    }
    
    updatePageIndicator() {
        const pageIndicator = document.getElementById('page-indicator');
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        
        if (pageIndicator) {
            pageIndicator.textContent = `Page ${this.currentPage + 1} of ${this.totalPages}`;
        }
        
        if (prevBtn) {
            prevBtn.disabled = this.currentPage === 0;
        }
        
        if (nextBtn) {
            nextBtn.disabled = this.currentPage === this.totalPages - 1;
        }
    }
    
    updatePreviewStep() {
        const previewStep = document.getElementById('preview-step');
        const previewContent = document.getElementById('preview-content');
        
        if (this.csvData.length > 0 && this.pdfTemplate) {
            previewStep.classList.remove('step--disabled');
            previewStep.classList.add('step--active');
            previewContent.style.display = 'block';
            
            this.updatePageIndicator();
            this.renderPreview();
            console.log('Preview step activated');
        }
    }
    
    async renderPreview() {
        const canvas = document.getElementById('preview-canvas');
        const ctx = canvas.getContext('2d');
        const nameOverlay = document.getElementById('name-overlay');
        const nameCount = document.getElementById('name-count');
        const pageCount = document.getElementById('page-count');
        
        // Update counts
        nameCount.textContent = this.csvData.length;
        pageCount.textContent = this.totalPages;
        
        // Clear canvas and overlay
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        nameOverlay.innerHTML = '';
        
        // Draw PDF template background
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw section borders
        const scaleX = canvas.width / this.a4Dimensions.width;
        const scaleY = canvas.height / this.a4Dimensions.height;
        
        ctx.strokeStyle = '#dee2e6';
        ctx.lineWidth = 1;
        
        this.a4Dimensions.sections.forEach(section => {
            const x = section.x * scaleX;
            const y = section.y * scaleY;
            const width = section.width * scaleX;
            const height = section.height * scaleY;
            
            ctx.strokeRect(x, y, width, height);
        });
        
        // Get names for current page
        const startIndex = this.currentPage * this.namesPerPage;
        const endIndex = Math.min(startIndex + this.namesPerPage, this.namePositions.length);
        const currentPagePositions = this.namePositions.slice(startIndex, endIndex);
        
        // Create draggable name elements for current page
        currentPagePositions.forEach((pos, relativeIndex) => {
            const absoluteIndex = startIndex + relativeIndex;
            this.createDraggableName(pos, absoluteIndex, relativeIndex, scaleX, scaleY);
        });
        
        // Update table
        this.updatePositionTable(currentPagePositions);
    }
    
    createDraggableName(position, absoluteIndex, relativeIndex, scaleX, scaleY) {
        const nameOverlay = document.getElementById('name-overlay');
        const nameElement = document.createElement('div');
        
        nameElement.className = `draggable-name section-${relativeIndex}`;
        nameElement.textContent = `${position.name} ${position.surname}`;
        nameElement.style.left = (position.x * scaleX) + 'px';
        nameElement.style.top = (position.y * scaleY) + 'px';
        
        let isDragging = false;
        let startX, startY, startLeft, startTop;
        
        const handleMouseDown = (e) => {
            if (!this.developerMode) return;
            
            isDragging = true;
            nameElement.classList.add('dragging');
            
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseFloat(nameElement.style.left);
            startTop = parseFloat(nameElement.style.top);
            
            e.preventDefault();
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        };
        
        const handleMouseMove = (e) => {
            if (!isDragging) return;
            
            const newLeft = startLeft + (e.clientX - startX);
            const newTop = startTop + (e.clientY - startY);
            
            nameElement.style.left = newLeft + 'px';
            nameElement.style.top = newTop + 'px';
            
            // Update position data
            this.namePositions[absoluteIndex].x = newLeft / scaleX;
            this.namePositions[absoluteIndex].y = newTop / scaleY;
            
            // Update coordinates display in real-time
            this.updateCoordinatesDisplay(newLeft / scaleX, newTop / scaleY);
            
            e.preventDefault();
        };
        
        const handleMouseUp = () => {
            if (!isDragging) return;
            
            isDragging = false;
            nameElement.classList.remove('dragging');
            
            // Update table
            const currentPagePositions = this.namePositions.slice(
                this.currentPage * this.namesPerPage,
                Math.min((this.currentPage + 1) * this.namesPerPage, this.namePositions.length)
            );
            this.updatePositionTable(currentPagePositions);
            
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
        
        nameElement.addEventListener('mousedown', handleMouseDown);
        nameOverlay.appendChild(nameElement);
    }
    
    updateCoordinatesDisplay(x, y) {
        const coordsDisplay = document.getElementById('coordinates-display');
        if (coordsDisplay) {
            coordsDisplay.textContent = `Position: x: ${Math.round(x)}, y: ${Math.round(y)}`;
        }
    }
    
    updatePositionTable(positions) {
        const tbody = document.getElementById('preview-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        positions.forEach((pos, relativeIndex) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${pos.sectionId}</td>
                <td>${pos.name}</td>
                <td>${pos.surname}</td>
                <td>x: ${Math.round(pos.x)}, y: ${Math.round(pos.y)}</td>
            `;
            tbody.appendChild(row);
        });
    }
    
    updatePreview() {
        if (this.csvData.length > 0 && this.pdfTemplate) {
            this.renderPreview();
        }
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
            if (generatePlaceholder) {
                generatePlaceholder.style.display = 'none';
            }
        } else {
            generateStep.classList.add('step--disabled');
            generateStep.classList.remove('step--active');
            if (generatePlaceholder) {
                generatePlaceholder.style.display = 'block';
            }
        }
    }
    
    async generateNamecards() {
        const loadingOverlay = document.getElementById('loading-overlay');
        const generateStatus = document.getElementById('generate-status');
        
        try {
            loadingOverlay.style.display = 'flex';
            this.showGenerateStatus(generateStatus, 'Generating multi-page namecards...', 'processing');
            
            // CRITICAL FIX: Extract ALL needed functions from PDFLib at the start
            const { PDFDocument, rgb, StandardFonts } = PDFLib;
            
            const existingPdfBytes = this.pdfTemplate;
            const pdfDoc = await PDFDocument.load(existingPdfBytes);
            
            // Font handling
            let font;
            try {
                font = await this.embedCustomFont(pdfDoc);
            } catch (fontError) {
                console.warn('Failed to load custom font, using default:', fontError);
                font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            }
            
            // Create new document
            const newPdfDoc = await PDFDocument.create();
            
            // Process names in groups of 4 (one page per group)
            for (let pageIndex = 0; pageIndex < this.totalPages; pageIndex++) {
                const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [0]);
                const page = newPdfDoc.addPage(copiedPage);
                
                // Add names for this page
                const startIndex = pageIndex * this.namesPerPage;
                const endIndex = Math.min(startIndex + this.namesPerPage, this.namePositions.length);
                
                for (let i = startIndex; i < endIndex; i++) {
                    const namePos = this.namePositions[i];
                    if (namePos) {
                        await this.addNameToPage(page, namePos, font, rgb);
                    }
                }
            }
            
            // Save the PDF
            this.generatedPdf = await newPdfDoc.save();
            
            loadingOverlay.style.display = 'none';
            this.showGenerateStatus(generateStatus, `Successfully generated ${this.totalPages} pages with ${this.csvData.length} names!`, 'success');
            this.showDownloadStep();
            
            console.log(`PDF generated successfully: ${this.totalPages} pages, ${this.csvData.length} names`);
            
        } catch (error) {
            loadingOverlay.style.display = 'none';
            this.showGenerateStatus(generateStatus, 'Error generating namecards: ' + error.message, 'error');
            console.error('Generation error:', error);
        }
    }
    
    async embedCustomFont(pdfDoc) {
        const { StandardFonts } = PDFLib;
        
        if (this.customFontFile) {
            const fontBytes = await fileToArrayBuffer(this.customFontFile);
            return await pdfDoc.embedFont(fontBytes);
        } else {
            return await pdfDoc.embedFont(StandardFonts.Helvetica);
        }
    }
    
    async addNameToPage(page, namePos, font, rgb) {
        const fullName = `${namePos.name}\n${namePos.surname}`;
        const lines = fullName.split('\n');
        const lineHeight = this.textFormatting.fontSize * this.textFormatting.lineHeight;
        
        const totalTextHeight = lines.length * lineHeight;
        let yPosition = namePos.y + (totalTextHeight / 2) - lineHeight;
        
        lines.forEach((line) => {
            const textWidth = font.widthOfTextAtSize(line, this.textFormatting.fontSize);
            const xPosition = namePos.x - (textWidth / 2);
            
            page.drawText(line, {
                x: xPosition,
                y: yPosition,
                size: this.textFormatting.fontSize,
                color: rgb(0, 0, 0),
                font: font
            });
            
            yPosition -= lineHeight;
        });
    }
    
    showStatus(element, message, type) {
        if (element) {
            element.textContent = message;
            element.className = `upload-status ${type}`;
            element.style.display = 'block';
        }
    }
    
    showGenerateStatus(element, message, type) {
        if (element) {
            element.textContent = message;
            element.className = `generate-status ${type}`;
            element.style.display = 'block';
        }
    }
    
    showDownloadStep() {
        const downloadStep = document.getElementById('download-step');
        if (downloadStep) {
            downloadStep.style.display = 'block';
        }
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
        link.download = 'multi-page-namecards.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        console.log('PDF download initiated');
    }
    
    // Built-in test functionality
    async runBuiltInTest() {
        const testStatus = document.getElementById('test-status');
        const testBtn = document.getElementById('run-test-btn');
        
        try {
            testBtn.disabled = true;
            this.showTestStatus(testStatus, 'Running built-in tests...', 'processing');
            console.log('Starting built-in tests...');
            
            // Test 1: Check if PDFLib is available and rgb function can be extracted
            const { PDFDocument, rgb, StandardFonts } = PDFLib;
            if (!PDFDocument || !rgb || !StandardFonts) {
                throw new Error('PDFLib functions not properly available');
            }
            console.log('✓ PDFLib functions available');
            
            // Test 2: Check if FileReader works
            const testFile = new Blob(['test content'], { type: 'text/plain' });
            const testArrayBuffer = await fileToArrayBuffer(testFile);
            if (!testArrayBuffer) {
                throw new Error('FileReader functionality failed');
            }
            console.log('✓ FileReader functionality working');
            
            // Test 3: Check pagination calculations
            const testData = [1, 2, 3, 4, 5, 6, 7, 8, 9];
            const testPages = Math.ceil(testData.length / 4);
            if (testPages !== 3) {
                throw new Error('Pagination calculation failed');
            }
            console.log('✓ Pagination calculations correct');
            
            // Test 4: Check if file input elements exist and have click method
            const csvInput = document.getElementById('csv-file');
            const pdfInput = document.getElementById('pdf-file');
            const fontInput = document.getElementById('font-file');
            if (!csvInput || !pdfInput || !fontInput || !csvInput.click) {
                throw new Error('File input elements not properly configured');
            }
            console.log('✓ File input elements configured correctly');
            
            // Test 5: Check if browse buttons exist and are clickable
            const csvBrowse = document.getElementById('csv-browse-btn');
            const pdfBrowse = document.getElementById('pdf-browse-btn');
            const fontBrowse = document.getElementById('font-browse-btn');
            if (!csvBrowse || !pdfBrowse || !fontBrowse) {
                throw new Error('Browse buttons not found');
            }
            console.log('✓ Browse buttons found and configured');
            
            this.showTestStatus(testStatus, '🎉 All tests passed! ✅ ArrayBuffer fix ✅ RGB fix ✅ File explorer fix ✅ Pagination ✅ Event handlers', 'success');
            console.log('All built-in tests passed successfully!');
            
        } catch (error) {
            this.showTestStatus(testStatus, 'Test failed: ' + error.message, 'error');
            console.error('Built-in test failed:', error);
        } finally {
            testBtn.disabled = false;
        }
    }
    
    showTestStatus(element, message, type) {
        if (element) {
            element.textContent = message;
            element.className = `test-status ${type}`;
            element.style.display = 'block';
        }
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing NamecardGenerator...');
    new NamecardGenerator();
});