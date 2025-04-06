// JavaScript for the collection view functionality

// Global variables for pagination
let currentPage = 1;
let totalPages = 1;
let documentsPerPage = 5;
let selectedDocuments = new Set();

function initializeCollectionView() {
    // Load initial documents and stats
    loadDocuments();
    loadCollectionStats();
    
    // Set up delete selected button
    const deleteSelectedButton = document.getElementById('delete-selected-btn');
    if (deleteSelectedButton) {
        deleteSelectedButton.addEventListener('click', deleteSelectedDocuments);
    }
    
    // Set up refresh button
    const refreshButton = document.getElementById('refresh-collection-btn');
    if (refreshButton) {
        refreshButton.addEventListener('click', function() {
            loadDocuments();
            loadCollectionStats();
        });
    }
}

// Fetch collection statistics including total size
async function loadCollectionStats() {
    try {
        const stats = await fetchWithErrorHandling('/api/get-collection-stats');
        
        // Update document count and storage size in the UI
        const docCountElement = document.getElementById('document-count');
        if (docCountElement) {
            const count = stats.vectors_count || 0;
            docCountElement.textContent = `${count} Document${count !== 1 ? 's' : ''}`;
        }
        
        const storageSizeElement = document.getElementById('storage-size');
        if (storageSizeElement) {
            storageSizeElement.innerHTML = `<i class="fas fa-database"></i> ${stats.total_size_formatted || '0 KB'}`;
        }
        
    } catch (error) {
        console.error('Error loading collection stats:', error);
    }
}

// Load documents from the API
async function loadDocuments(page = 1) {
    currentPage = page;
    showLoading('collection-loading');
    
    try {
        const data = await fetchWithErrorHandling(`/api/get-documents?page=${page}&per_page=${documentsPerPage}`);
        
        // Update total pages
        totalPages = data.total_pages || 1;
        
        // Clear selected documents when loading new page
        selectedDocuments.clear();
        
        // Render documents
        renderDocuments(data.documents);
        
        // Render pagination
        renderPagination();
        
        // Update delete selected button state
        updateDeleteSelectedButton();
        
    } catch (error) {
        console.error('Error loading documents:', error);
        showAlert(error.message || 'Failed to load documents', 'error', 'collection-alerts');
    } finally {
        hideLoading('collection-loading');
    }
}

// Render documents in the collection
function renderDocuments(documents) {
    const cardsContainer = document.getElementById('cards-container');
    if (!cardsContainer) return;
    
    // Clear current documents
    cardsContainer.innerHTML = '';
    
    // Handle empty collection
    if (!documents || documents.length === 0) {
        cardsContainer.innerHTML = `
            <div class="empty-state">
                <p>No documents found in the collection.</p>
                <p>Upload documents using the left panel to get started.</p>
            </div>
        `;
        return;
    }
    
    // Render each document
    documents.forEach(doc => {
        const payload = doc.payload || {};
        const title = payload.title || 'Untitled Document';
        const preview = payload.preview || 'No preview available';
        const timestamp = payload.timestamp ? formatDate(payload.timestamp) : 'Unknown date';
        const sourceType = payload.source_type || 'unknown';
        const source = payload.source || 'Unknown source';
        const words = payload.words || 0;
        const chars = payload.chars || 0;
        
        const card = document.createElement('div');
        card.className = 'document-card';
        card.setAttribute('data-id', doc.id);
        
        // Add selected class if document is selected
        if (selectedDocuments.has(doc.id)) {
            card.classList.add('selected');
        }
        
        card.innerHTML = `
            <div class="card-header">
                <div class="d-flex align-items-center">
                    <input type="checkbox" class="card-checkbox" 
                        ${selectedDocuments.has(doc.id) ? 'checked' : ''}>
                    <h3 class="card-title">${title}</h3>
                </div>
                <div class="card-actions">
                    <button class="card-action delete-doc-btn" title="Delete document">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="card-preview">${preview}</div>
            <div class="card-meta">
                <span class="card-meta-item">
                    <i class="far fa-calendar"></i> ${timestamp}
                </span>
                <span class="card-meta-item">
                    <i class="fas fa-tag"></i> ${sourceType}
                </span>
                <span class="card-meta-item">
                    <i class="fas fa-link"></i> ${source}
                </span>
                <span class="card-meta-item">
                    <i class="fas fa-file-alt"></i> ${words} words, ${chars} chars
                </span>
            </div>
        `;
        
        cardsContainer.appendChild(card);
        
        // Add event listeners
        const checkbox = card.querySelector('.card-checkbox');
        if (checkbox) {
            checkbox.addEventListener('change', function() {
                toggleDocumentSelection(doc.id, this.checked);
                card.classList.toggle('selected', this.checked);
            });
        }
        
        const deleteButton = card.querySelector('.delete-doc-btn');
        if (deleteButton) {
            deleteButton.addEventListener('click', function() {
                deleteDocument(doc.id);
            });
        }
        
        // Make the whole card selectable (except when clicking buttons)
        card.addEventListener('click', function(event) {
            // Only toggle if not clicking on a button or checkbox
            if (!event.target.closest('button') && !event.target.closest('input[type="checkbox"]')) {
                const checkbox = this.querySelector('.card-checkbox');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    toggleDocumentSelection(doc.id, checkbox.checked);
                    card.classList.toggle('selected', checkbox.checked);
                }
            }
        });
    });
}

// Render pagination controls
function renderPagination() {
    const paginationContainer = document.getElementById('pagination-container');
    if (!paginationContainer) return;
    
    // Clear current pagination
    paginationContainer.innerHTML = '';
    
    // Don't show pagination if only one page
    if (totalPages <= 1) return;
    
    const pagination = document.createElement('ul');
    pagination.className = 'pagination';
    
    // Previous button
    const prevItem = document.createElement('li');
    prevItem.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    
    const prevLink = document.createElement('a');
    prevLink.className = 'page-link';
    prevLink.innerHTML = '&laquo;';
    prevLink.href = '#';
    
    if (currentPage > 1) {
        prevLink.addEventListener('click', function(e) {
            e.preventDefault();
            loadDocuments(currentPage - 1);
        });
    }
    
    prevItem.appendChild(prevLink);
    pagination.appendChild(prevItem);
    
    // Page numbers
    const maxPages = 5; // Maximum number of page links to show
    const startPage = Math.max(1, currentPage - Math.floor(maxPages / 2));
    const endPage = Math.min(totalPages, startPage + maxPages - 1);
    
    for (let i = startPage; i <= endPage; i++) {
        const pageItem = document.createElement('li');
        pageItem.className = `page-item ${i === currentPage ? 'active' : ''}`;
        
        const pageLink = document.createElement('a');
        pageLink.className = 'page-link';
        pageLink.textContent = i;
        pageLink.href = '#';
        
        if (i !== currentPage) {
            pageLink.addEventListener('click', function(e) {
                e.preventDefault();
                loadDocuments(i);
            });
        }
        
        pageItem.appendChild(pageLink);
        pagination.appendChild(pageItem);
    }
    
    // Next button
    const nextItem = document.createElement('li');
    nextItem.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    
    const nextLink = document.createElement('a');
    nextLink.className = 'page-link';
    nextLink.innerHTML = '&raquo;';
    nextLink.href = '#';
    
    if (currentPage < totalPages) {
        nextLink.addEventListener('click', function(e) {
            e.preventDefault();
            loadDocuments(currentPage + 1);
        });
    }
    
    nextItem.appendChild(nextLink);
    pagination.appendChild(nextItem);
    
    paginationContainer.appendChild(pagination);
}

// Toggle document selection
function toggleDocumentSelection(docId, isSelected) {
    if (isSelected) {
        selectedDocuments.add(docId);
    } else {
        selectedDocuments.delete(docId);
    }
    
    updateDeleteSelectedButton();
}

// Update delete selected button state
function updateDeleteSelectedButton() {
    const deleteSelectedButton = document.getElementById('delete-selected-btn');
    if (deleteSelectedButton) {
        deleteSelectedButton.disabled = selectedDocuments.size === 0;
    }
}

// Delete single document
async function deleteDocument(docId) {
    if (!confirm('Are you sure you want to delete this document?')) {
        return;
    }
    
    showLoading('collection-loading');
    
    try {
        const response = await fetch(`/api/delete-document/${docId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete document');
        }
        
        // Remove from selected documents if present
        selectedDocuments.delete(docId);
        
        // Reload current page
        loadDocuments(currentPage);
        
        // Update stats
        loadCollectionStats();
        
        showAlert('Document deleted successfully', 'success', 'collection-alerts');
    } catch (error) {
        console.error('Error deleting document:', error);
        showAlert(error.message || 'Failed to delete document', 'error', 'collection-alerts');
    } finally {
        hideLoading('collection-loading');
    }
}

// Delete selected documents
async function deleteSelectedDocuments() {
    if (selectedDocuments.size === 0) {
        showAlert('No documents selected', 'error', 'collection-alerts');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${selectedDocuments.size} selected document(s)?`)) {
        return;
    }
    
    showLoading('collection-loading');
    
    try {
        const response = await fetch('/api/delete-selected-documents', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ids: Array.from(selectedDocuments)
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete documents');
        }
        
        const data = await response.json();
        
        // Clear selected documents
        selectedDocuments.clear();
        
        // Reload current page
        loadDocuments(currentPage);
        
        // Update stats
        loadCollectionStats();
        
        showAlert(`Successfully deleted ${data.deleted_count} document(s)`, 'success', 'collection-alerts');
    } catch (error) {
        console.error('Error deleting documents:', error);
        showAlert(error.message || 'Failed to delete documents', 'error', 'collection-alerts');
    } finally {
        hideLoading('collection-loading');
    }
}
