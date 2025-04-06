// Main JavaScript file for the application

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Application initialized');
    
    // Initialize all components
    initializeUploadSection();
    initializeCollectionView();
    initializeChatInterface();
    initializeAnimations();
});

// Initialize cool animations and interactions
function initializeAnimations() {
    // Add hover effects to buttons
    const buttons = document.querySelectorAll('.btn-airbnb, .btn-outline-airbnb, .upload-option, .send-button');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-3px)';
            this.style.boxShadow = '0 7px 14px rgba(50, 50, 93, 0.1), 0 3px 6px rgba(0, 0, 0, 0.08)';
            this.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = '';
            this.style.boxShadow = '';
        });
    });
    
    // Add pulse animation to the AI message
    const aiMessage = document.querySelector('.message-ai');
    if (aiMessage) {
        aiMessage.style.animation = 'pulse 2s infinite';
    }
    
    // Add scrolling effect for panel headings
    window.addEventListener('scroll', function() {
        const headings = document.querySelectorAll('.panel-heading');
        headings.forEach(heading => {
            heading.style.backgroundPosition = `${window.scrollY * 0.2}px`;
        });
    });
    
    // Add ripple effect to all buttons
    document.addEventListener('click', function(e) {
        if (e.target.closest('.btn-airbnb, .btn-outline-airbnb, .send-button')) {
            const button = e.target.closest('.btn-airbnb, .btn-outline-airbnb, .send-button');
            const circle = document.createElement('span');
            const diameter = Math.max(button.clientWidth, button.clientHeight);
            
            circle.style.width = circle.style.height = `${diameter}px`;
            circle.style.left = `${e.clientX - button.getBoundingClientRect().left - diameter / 2}px`;
            circle.style.top = `${e.clientY - button.getBoundingClientRect().top - diameter / 2}px`;
            circle.classList.add('ripple');
            
            const ripple = button.getElementsByClassName('ripple')[0];
            if (ripple) {
                ripple.remove();
            }
            
            button.appendChild(circle);
        }
    });
}

// Show loading indicator
function showLoading(elementId) {
    const loadingElement = document.getElementById(elementId);
    if (loadingElement) {
        loadingElement.style.display = 'block';
    }
}

// Hide loading indicator
function hideLoading(elementId) {
    const loadingElement = document.getElementById(elementId);
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

// Show alert message with enhanced styling
function showAlert(message, type, container) {
    // Create alert element
    const alertElement = document.createElement('div');
    alertElement.className = `alert alert-${type}`;
    
    // Add icon based on alert type
    let icon = '';
    if (type === 'success') {
        icon = '<i class="fas fa-check-circle"></i> ';
    } else if (type === 'error') {
        icon = '<i class="fas fa-exclamation-circle"></i> ';
    }
    
    alertElement.innerHTML = `${icon}${message}`;
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'close';
    closeButton.innerHTML = '&times;';
    closeButton.addEventListener('click', function() {
        alertElement.remove();
    });
    
    alertElement.appendChild(closeButton);
    
    // Add fancy entrance animation
    alertElement.style.animation = 'slideIn 0.3s ease forwards';
    
    // Add alert to container
    const alertContainer = document.getElementById(container);
    if (alertContainer) {
        // Clear previous alerts
        const previousAlerts = alertContainer.querySelectorAll('.alert');
        previousAlerts.forEach(alert => alert.remove());
        
        // Add new alert
        alertContainer.appendChild(alertElement);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alertElement.parentNode) {
                alertElement.style.animation = 'slideOut 0.3s ease forwards';
                setTimeout(() => {
                    if (alertElement.parentNode) {
                        alertElement.remove();
                    }
                }, 300);
            }
        }, 5000);
    }
}

// Format date with fancy styling
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    // Show relative time for recent dates
    if (diffDay < 1) {
        if (diffHour < 1) {
            if (diffMin < 1) {
                return 'just now';
            }
            return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
        }
        return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
    } else if (diffDay < 7) {
        return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    }
    
    // Show formatted date for older dates
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Format file size with colors based on size
function formatFileSize(bytes) {
    if (bytes < 1024) {
        return `<span style="color: var(--success-color)">${bytes} B</span>`;
    } else if (bytes < 1024 * 1024) {
        return `<span style="color: var(--accent-color)">${(bytes / 1024).toFixed(1)} KB</span>`;
    } else {
        return `<span style="color: var(--warning-color)">${(bytes / (1024 * 1024)).toFixed(1)} MB</span>`;
    }
}

// Generic fetch function with error handling and loading effects
async function fetchWithErrorHandling(url, options = {}) {
    // Add fancy loading effect to the page during fetch
    document.body.classList.add('loading-fetch');
    
    try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
            // Try to parse error message from response
            try {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error: ${response.status}`);
            } catch (e) {
                // If can't parse JSON, use generic error
                throw new Error(`HTTP error: ${response.status}`);
            }
        }
        
        const data = await response.json();
        
        // Add a slight delay for better UI feedback
        await new Promise(resolve => setTimeout(resolve, 300));
        
        return data;
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    } finally {
        // Remove loading effect
        document.body.classList.remove('loading-fetch');
    }
}
