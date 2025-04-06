// JavaScript for the upload section functionality

function initializeUploadSection() {
    const uploadOptions = document.querySelectorAll('.upload-option');
    const uploadForms = document.querySelectorAll('.upload-form');
    const extractButton = document.getElementById('extract-content-btn');
    const storeButton = document.getElementById('store-document-btn');
    const contentPreview = document.getElementById('content-preview');
    
    // Initialize upload option selection
    uploadOptions.forEach(option => {
        option.addEventListener('click', function() {
            // Clear active class from all options
            uploadOptions.forEach(opt => opt.classList.remove('active'));
            
            // Set this option as active
            this.classList.add('active');
            
            // Hide all forms
            uploadForms.forEach(form => form.classList.remove('active'));
            
            // Show the corresponding form
            const sourceType = this.getAttribute('data-source');
            const form = document.getElementById(`${sourceType}-form`);
            if (form) {
                form.classList.add('active');
            }
        });
    });
    
    // Extract content button click handler
    if (extractButton) {
        extractButton.addEventListener('click', extractContent);
    }
    
    // Store document button click handler
    if (storeButton) {
        storeButton.addEventListener('click', storeDocument);
    }
}

// Extract content from selected source
async function extractContent() {
    // Get active source type
    const activeOption = document.querySelector('.upload-option.active');
    if (!activeOption) {
        showAlert('Please select a content source', 'error', 'upload-alerts');
        return;
    }
    
    const sourceType = activeOption.getAttribute('data-source');
    const contentPreview = document.getElementById('content-preview');
    
    // Show loading indicator
    showLoading('upload-loading');
    
    try {
        // Create FormData object
        const formData = new FormData();
        formData.append('source_type', sourceType);
        
        // Add file or URL based on source type
        if (sourceType === 'text' || sourceType === 'pdf' || sourceType === 'audio' || sourceType === 'image') {
            const fileInput = document.getElementById(`${sourceType}-file`);
            
            if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                throw new Error('Please select a file');
            }
            
            formData.append('file', fileInput.files[0]);
        } else if (sourceType === 'youtube' || sourceType === 'website') {
            const urlInput = document.getElementById(`${sourceType}-url`);
            
            if (!urlInput || !urlInput.value.trim()) {
                throw new Error('Please enter a valid URL');
            }
            
            formData.append('url', urlInput.value.trim());
        }
        
        // Make API request to extract content
        const response = await fetch('/api/extract-content', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to extract content');
        }
        
        const data = await response.json();
        
        // Update content preview
        if (contentPreview) {
            contentPreview.value = data.content;
            
            // Set source title based on source type
            const titleInput = document.getElementById('document-title');
            if (titleInput) {
                if (sourceType === 'text' || sourceType === 'pdf' || sourceType === 'audio' || sourceType === 'image') {
                    const fileInput = document.getElementById(`${sourceType}-file`);
                    titleInput.value = fileInput.files[0].name;
                } else if (sourceType === 'youtube' || sourceType === 'website') {
                    const urlInput = document.getElementById(`${sourceType}-url`);
                    titleInput.value = urlInput.value;
                }
            }
        }
        
        // Enable store button
        const storeButton = document.getElementById('store-document-btn');
        if (storeButton) {
            storeButton.disabled = false;
        }
        
        showAlert('Content extracted successfully', 'success', 'upload-alerts');
    } catch (error) {
        console.error('Error extracting content:', error);
        showAlert(error.message || 'Failed to extract content', 'error', 'upload-alerts');
    } finally {
        // Hide loading indicator
        hideLoading('upload-loading');
    }
}

// Store document in Qdrant collection
async function storeDocument() {
    const contentPreview = document.getElementById('content-preview');
    const titleInput = document.getElementById('document-title');
    
    if (!contentPreview || !contentPreview.value.trim()) {
        showAlert('No content to store', 'error', 'upload-alerts');
        return;
    }
    
    // Show loading indicator
    showLoading('upload-loading');
    
    try {
        // Get active source type
        const activeOption = document.querySelector('.upload-option.active');
        const sourceType = activeOption ? activeOption.getAttribute('data-source') : 'manual';
        
        // Get source info
        let source = 'User input';
        if (sourceType === 'youtube' || sourceType === 'website') {
            const urlInput = document.getElementById(`${sourceType}-url`);
            source = urlInput ? urlInput.value : 'Unknown URL';
        } else if (sourceType === 'text' || sourceType === 'pdf' || sourceType === 'audio' || sourceType === 'image') {
            const fileInput = document.getElementById(`${sourceType}-file`);
            source = fileInput && fileInput.files.length > 0 ? fileInput.files[0].name : 'Unknown file';
        }
        
        // Prepare document data
        const documentData = {
            text: contentPreview.value,
            title: titleInput ? titleInput.value : 'Untitled Document',
            source_type: sourceType,
            source: source
        };
        
        // Make API request to store document
        const response = await fetch('/api/store-document', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(documentData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to store document');
        }
        
        const data = await response.json();
        
        // Clear form
        contentPreview.value = '';
        if (titleInput) {
            titleInput.value = '';
        }
        
        // Disable store button
        const storeButton = document.getElementById('store-document-btn');
        if (storeButton) {
            storeButton.disabled = true;
        }
        
        // Refresh collection view
        if (typeof loadDocuments === 'function') {
            loadDocuments();
        }
        
        showAlert('Document stored successfully', 'success', 'upload-alerts');
    } catch (error) {
        console.error('Error storing document:', error);
        showAlert(error.message || 'Failed to store document', 'error', 'upload-alerts');
    } finally {
        // Hide loading indicator
        hideLoading('upload-loading');
    }
}
