class NamecardGenerator {
    constructor() {
        this.csvData = [];
        this.pdfTemplate = null;
        this.generatedPdf = null;
        
        // A4 dimensions and sections from provided data
        this.a4Dimensions = {
            width: 595.28,
            height: 841.89,
            sections: [
                { id: "top-left", x: 0, y: 420.945, width: 297.64, height: 420.945 },
                { id: "top-right", x: 297.64, y: 420.945, width: 297.64, height: 420.945 },
                { id: "bottom-left", x: 0, y: 0, width: 297.64, height: 420.945 },
                { id: "bottom-right", x: 297.64, y: 0, width: 297.64, height: 420.945 }
            ]
        };
        
        this.textFormatting = {
            fontSize: 18,
            fontColor: [0, 0, 0], // RGB for black
            lineHeight: 1.2
        };
        
        this.initializeEventListeners();
    }
    
    initializeEventListeners() {
        // CSV file upload
        const csvUploadArea = document.getElementById('csv-upload-area');
        const csvFileInput = document.getElementById('csv-file');
        
        this.setupFileUpload(csvUploadArea, csvFileInput, this.handleCsvUpload.bind(this));
        
        // PDF file upload
        const pdfUploadArea = document.getElementById('pdf-upload-area');
        const pdfFileInput = document.getElementById('pdf-file');
        
        this.setupFileUpload(pdfUploadArea, pdfFileInput, this.handlePdfUpload.bind(this));
        
        // Generate button
        document.getElementById('generate-btn').addEventListener('click', this.generateNamecards.bind(this));
        
        // Download button
        document.getElementById('download-btn').addEventListener('click', this.downloadPdf.bind(this));
    }
    
    setupFileUpload(uploadArea, fileInput, handler) {
        // Click to upload
        uploadArea.addEventListener('click', () => fileInput.click());
        
        // File input change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handler(e.target.files[0]);
            }
        });
        
        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            if (e.dataTransfer.files.length > 0) {
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
                
                // Validate required columns
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
                
                // Filter out empty rows
                this.csvData = data.filter(row => row.Name && row.Surname);
                
                if (this.csvData.length === 0) {
                    this.showStatus(statusEl, 'No valid name entries found in CSV', 'error');
                    return;
                }
                
                uploadArea.classList.add('has-file');
                this.showStatus(statusEl, `Successfully loaded ${this.csvData.length} names`, 'success');
                this.activatePreviewStep();
                this.updateGenerateButton();
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
            this.updateGenerateButton();
        };
        
        reader.onerror = () => {
            this.showStatus(statusEl, 'Error reading PDF file', 'error');
        };
        
        reader.readAsArrayBuffer(file);
    }
    
    showStatus(element, message, type) {
        element.textContent = message;
        element.className = `upload-status ${type}`;
        element.style.display = 'block';
    }
    
    activatePreviewStep() {
        const previewStep = document.getElementById('preview-step');
        const previewContent = document.getElementById('preview-content');
        const nameCount = document.getElementById('name-count');
        const tbody = document.getElementById('preview-tbody');
        
        // Activate the step
        previewStep.classList.remove('step--disabled');
        previewStep.classList.add('step--active');
        
        // Show content and hide placeholder
        previewContent.style.display = 'block';
        
        // Update the data
        nameCount.textContent = this.csvData.length;
        
        tbody.innerHTML = '';
        this.csvData.forEach((person, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${person.Name}</td>
                <td>${person.Surname}</td>
            `;
            tbody.appendChild(row);
        });
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
        const loadingOverlay = document.getElementById('loading-overlay');
        const generateStatus = document.getElementById('generate-status');
        
        try {
            loadingOverlay.style.display = 'flex';
            this.showGenerateStatus(generateStatus, 'Generating namecards...', 'processing');
            
            // Load PDF-lib
            const { PDFDocument, rgb, StandardFonts } = PDFLib;
            
            // Load the template PDF
            const templatePdf = await PDFDocument.load(this.pdfTemplate);
            const templatePage = templatePdf.getPages()[0];
            
            // Create new PDF document
            const pdfDoc = await PDFDocument.create();
            const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
            
            // Process names in groups of 4 (one page)
            let currentPageIndex = 0;
            
            for (let i = 0; i < this.csvData.length; i += 4) {
                // Copy template page
                const [copiedPage] = await pdfDoc.copyPages(templatePdf, [0]);
                const page = pdfDoc.addPage(copiedPage);
                
                // Add names to sections
                for (let j = 0; j < 4 && i + j < this.csvData.length; j++) {
                    const person = this.csvData[i + j];
                    const section = this.a4Dimensions.sections[j];
                    
                    await this.addNameToSection(page, person, section, helveticaFont);
                }
                
                currentPageIndex++;
            }
            
            // Save the PDF
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
    
    async addNameToSection(page, person, section, font) {
        const { fontSize } = this.textFormatting;
        const text = `${person.Name}\n${person.Surname}`;
        
        // Calculate center position for the section
        const centerX = section.x + (section.width / 2);
        const centerY = section.y + (section.height / 2);
        
        // Measure text dimensions
        const lines = text.split('\n');
        const lineHeight = fontSize * this.textFormatting.lineHeight;
        const totalTextHeight = lines.length * lineHeight;
        
        // Position text at center of section
        let yPosition = centerY + (totalTextHeight / 2) - lineHeight;
        
        lines.forEach((line) => {
            const textWidth = font.widthOfTextAtSize(line, fontSize);
            const xPosition = centerX - (textWidth / 2);
            
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