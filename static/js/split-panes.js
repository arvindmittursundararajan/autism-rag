// Split Panes JavaScript file
// Handles the initialization and management of resizable panes

// Wait for DOM to load before initializing split panes
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing split panes');
    initializeSplitPanes();
    initializeTooltips();
    initializeAnimations();
});

// Initialize Split.js for resizable panes
function initializeSplitPanes() {
    // Check if Split.js is available
    if (typeof Split === 'undefined') {
        console.error('Split.js is not loaded');
        return;
    }
    
    // Create split panes with drag-to-resize capability
    try {
        Split(['#left-pane', '#middle-pane', '#right-pane'], {
            sizes: [30, 30, 40],
            minSize: [250, 250, 300],
            gutterSize: 6,
            snapOffset: 0,
            dragInterval: 1,
            direction: 'horizontal',
            cursor: 'col-resize',
            gutter: (index, direction) => {
                const gutter = document.createElement('div');
                gutter.className = `gutter gutter-${direction}`;
                return gutter;
            },
            elementStyle: (dimension, size, gutterSize) => ({
                'flex-basis': `calc(${size}% - ${gutterSize}px)`,
            }),
            gutterStyle: (dimension, gutterSize) => ({
                'flex-basis': `${gutterSize}px`,
            }),
            onDragEnd: savePaneSizes
        });
        console.log('Split panes initialized successfully');
    } catch (error) {
        console.error('Error initializing split panes:', error);
    }
    
    // Try to restore saved pane sizes
    restorePaneSizes();
}

// Save pane sizes for persistence
function savePaneSizes() {
    const leftPane = document.getElementById('left-pane');
    const middlePane = document.getElementById('middle-pane');
    const rightPane = document.getElementById('right-pane');
    
    if (leftPane && middlePane && rightPane) {
        const sizes = [
            leftPane.style.flexBasis,
            middlePane.style.flexBasis,
            rightPane.style.flexBasis
        ];
        
        localStorage.setItem('paneSizes', JSON.stringify(sizes));
        console.log('Saved pane sizes:', sizes);
    }
}

// Restore saved pane sizes
function restorePaneSizes() {
    try {
        const savedSizes = localStorage.getItem('paneSizes');
        if (savedSizes) {
            const sizes = JSON.parse(savedSizes);
            const leftPane = document.getElementById('left-pane');
            const middlePane = document.getElementById('middle-pane');
            const rightPane = document.getElementById('right-pane');
            
            if (leftPane && middlePane && rightPane && sizes.length === 3) {
                leftPane.style.flexBasis = sizes[0];
                middlePane.style.flexBasis = sizes[1];
                rightPane.style.flexBasis = sizes[2];
                console.log('Restored pane sizes:', sizes);
            }
        }
    } catch (error) {
        console.error('Error restoring pane sizes:', error);
    }
}

// Initialize tooltips
function initializeTooltips() {
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    
    tooltipElements.forEach(element => {
        // Tooltip is implemented via CSS
        // The data-tooltip attribute is used to set the tooltip text
        console.log('Tooltip initialized for:', element);
    });
}

// Initialize animations and visual effects
function initializeAnimations() {
    // Add hover effects for all interactive elements
    const interactiveElements = document.querySelectorAll('.btn-airbnb, .btn-outline-airbnb, .upload-option, .card-action, .send-button');
    
    interactiveElements.forEach(element => {
        element.addEventListener('mouseover', function() {
            this.style.transform = 'translateY(-2px)';
            this.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        });
        
        element.addEventListener('mouseout', function() {
            this.style.transform = 'translateY(0)';
        });
    });
    
    // Add pulsing effect to the send button
    const sendButton = document.querySelector('.send-button');
    if (sendButton) {
        setInterval(() => {
            sendButton.classList.add('pulse');
            setTimeout(() => {
                sendButton.classList.remove('pulse');
            }, 1000);
        }, 5000);
    }
}

// Additional visual enhancement: Add cool scrolling effect
window.addEventListener('scroll', function() {
    const scrollPosition = window.scrollY;
    const maxScroll = document.body.scrollHeight - window.innerHeight;
    const scrollPercentage = (scrollPosition / maxScroll) * 100;
    
    // Create a subtle parallax effect for the background
    const bgAnimation = document.querySelector('.bg-animation');
    if (bgAnimation) {
        bgAnimation.style.transform = `translateY(${scrollPercentage * 0.2}px)`;
    }
});

// Add a ripple effect to buttons for extra coolness
document.addEventListener('click', function(e) {
    if (e.target.matches('.btn-airbnb, .btn-outline-airbnb, .send-button')) {
        const button = e.target;
        const ripple = document.createElement('span');
        
        ripple.classList.add('ripple');
        button.appendChild(ripple);
        
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
        ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
        
        ripple.classList.add('active');
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }
});