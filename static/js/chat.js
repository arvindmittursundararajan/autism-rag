// JavaScript for the chat interface functionality

// Chat history
let chatHistory = [];
// Store citations for reference
let citationsRegistry = {};

function initializeChatInterface() {
    // Set up chat form submission
    const chatForm = document.getElementById('chat-form');
    if (chatForm) {
        chatForm.addEventListener('submit', handleChatSubmit);
    }
    
    // Set up toggle switches
    const knowledgeToggle = document.getElementById('knowledge-search-toggle');
    const webToggle = document.getElementById('web-search-toggle');
    
    // Set initial state (knowledge search on by default)
    if (knowledgeToggle) {
        knowledgeToggle.checked = true;
    }
    
    // Set up clear chat button
    const clearChatBtn = document.getElementById('clear-chat-btn');
    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', clearChat);
    }
    
    // Set up citations modal close button
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('close-modal')) {
            document.getElementById('citations-modal').style.display = 'none';
        }
    });
    
    // Close modal when clicking outside content
    window.addEventListener('click', function(e) {
        const modal = document.getElementById('citations-modal');
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Scroll to bottom of messages container
    scrollToBottom();
}

// Clear chat messages
function clearChat() {
    const messagesContainer = document.getElementById('messages-container');
    if (messagesContainer) {
        // Keep only the welcome message
        const welcomeMessage = messagesContainer.querySelector('.message-ai:first-child');
        messagesContainer.innerHTML = '';
        if (welcomeMessage) {
            messagesContainer.appendChild(welcomeMessage);
        }
        
        // Clear chat history
        chatHistory = [];
        citationsRegistry = {};
    }
}

// Handle chat form submission
async function handleChatSubmit(event) {
    event.preventDefault();
    
    const chatInput = document.getElementById('chat-input');
    const messagesContainer = document.getElementById('messages-container');
    
    if (!chatInput || !messagesContainer) return;
    
    const message = chatInput.value.trim();
    if (!message) return;
    
    // Get search toggle states
    const useKnowledgeSearch = document.getElementById('knowledge-search-toggle')?.checked || false;
    const useWebSearch = document.getElementById('web-search-toggle')?.checked || false;
    
    // Add user message to UI
    addMessageToUI(message, 'user');
    
    // Clear input
    chatInput.value = '';
    
    // Show loading indicator
    showLoading('chat-loading');
    
    try {
        // Make API request
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                use_knowledge_search: useKnowledgeSearch,
                use_web_search: useWebSearch
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to get response');
        }
        
        const data = await response.json();
        
        // Add AI response to UI
        addMessageToUI(data.response, 'ai', data.citations);
        
    } catch (error) {
        console.error('Error in chat:', error);
        
        // Add error message to UI
        addMessageToUI(`Error: ${error.message || 'Failed to get response'}`, 'ai');
        
    } finally {
        hideLoading('chat-loading');
        scrollToBottom();
    }
}

// Add a message to the UI
function addMessageToUI(message, sender, citations = []) {
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) return;
    
    // Create message element
    const messageElement = document.createElement('div');
    messageElement.className = `message message-${sender}`;
    
    // Add sender label
    const senderLabel = document.createElement('div');
    senderLabel.className = 'message-sender';
    senderLabel.textContent = sender === 'user' ? 'You' : 'AI Assistant';
    messageElement.appendChild(senderLabel);
    
    // Register citations for modal display
    if (citations && citations.length > 0) {
        const messageId = 'msg-' + Date.now();
        citationsRegistry[messageId] = citations;
        messageElement.dataset.messageId = messageId;
    }
    
    // Add message content with numbered citations
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    // If there are citations, format them with numbers
    if (citations && citations.length > 0) {
        let processedMessage = message;
        
        // Replace citation tags with numbered references
        citations.forEach((citation, index) => {
            const citationKey = citation.source.startsWith('Knowledge Base') ? `KB${index + 1}` : `WEB${index + 1}`;
            const citationTag = `[${citationKey}]`;
            const numberRef = `[${index + 1}]`;
            
            processedMessage = processedMessage.replace(new RegExp('\\[' + citationKey + '\\]', 'g'), numberRef);
        });
        
        messageContent.innerHTML = formatMessage(processedMessage);
        
        // Make citation numbers clickable
        setTimeout(() => {
            const citationRefs = messageContent.querySelectorAll('.citation-ref');
            citationRefs.forEach(ref => {
                ref.addEventListener('click', () => {
                    showCitationsModal(messageElement.dataset.messageId);
                });
            });
        }, 0);
    } else {
        messageContent.innerHTML = formatMessage(message);
    }
    
    messageElement.appendChild(messageContent);
    
    // Hide citations from the message since they'll be in modal
    
    // Add timestamp (hidden - only used for sorting)
    const timestamp = document.createElement('div');
    timestamp.className = 'message-timestamp';
    timestamp.style.display = 'none';
    timestamp.textContent = new Date().toLocaleTimeString();
    messageElement.appendChild(timestamp);
    
    // Add to messages container
    messagesContainer.appendChild(messageElement);
    
    // Add to chat history
    chatHistory.push({
        message: message,
        sender: sender,
        citations: citations,
        timestamp: new Date()
    });
    
    // Scroll to bottom
    scrollToBottom();
}

// Show citations in modal
function showCitationsModal(messageId) {
    const citations = citationsRegistry[messageId];
    if (!citations || citations.length === 0) return;
    
    const modal = document.getElementById('citations-modal');
    const modalContent = document.getElementById('citations-modal-content');
    
    if (!modal || !modalContent) return;
    
    // Clear previous content
    modalContent.innerHTML = '';
    
    // Add title
    const modalTitle = document.createElement('h3');
    modalTitle.textContent = 'Citations';
    modalContent.appendChild(modalTitle);
    
    // Add close button
    const closeButton = document.createElement('span');
    closeButton.className = 'close-modal';
    closeButton.innerHTML = '&times;';
    modalTitle.appendChild(closeButton);
    
    // Add citations
    citations.forEach((citation, index) => {
        const citationElement = document.createElement('div');
        citationElement.className = 'modal-citation';
        
        // Add citation number
        const citationNumber = document.createElement('div');
        citationNumber.className = 'citation-number';
        citationNumber.textContent = `[${index + 1}]`;
        citationElement.appendChild(citationNumber);
        
        // Add citation content
        const citationContent = document.createElement('div');
        citationContent.className = 'citation-content';
        citationContent.innerHTML = formatMessage(citation.text);
        citationElement.appendChild(citationContent);
        
        // Add citation source
        const sourceElement = document.createElement('div');
        sourceElement.className = 'citation-source';
        sourceElement.textContent = `Source: ${citation.source}`;
        citationContent.appendChild(sourceElement);
        
        modalContent.appendChild(citationElement);
    });
    
    // Show modal
    modal.style.display = 'flex';
}

// Format message text (convert line breaks to <br> and add basic markdown support)
function formatMessage(text) {
    if (!text) return '';
    
    // Convert line breaks to <br>
    text = text.replace(/\n/g, '<br>');
    
    // Convert markdown-style links: [text](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // Convert markdown-style bold: **text**
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Convert markdown-style italic: *text*
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Convert markdown-style code: `code`
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Convert numbered citations: [1], [2], etc.
    text = text.replace(/\[(\d+)\]/g, '<span class="citation-ref">[<strong>$1</strong>]</span>');
    
    // Old format - keep for backward compatibility
    text = text.replace(/\[(KB\d+|WEB\d+)\]/g, '<span class="citation-ref">[$1]</span>');
    
    return text;
}

// Scroll to bottom of messages container
function scrollToBottom() {
    const messagesContainer = document.getElementById('messages-container');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}
