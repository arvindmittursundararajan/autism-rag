import os
import logging
from flask import Flask, render_template, request, jsonify
from werkzeug.middleware.proxy_fix import ProxyFix

from config import UPLOAD_FOLDER
from qdrant_service import QdrantService
from utils.extractors import (
    extract_text_from_file, extract_text_from_pdf, 
    extract_text_from_youtube, extract_text_from_audio,
    extract_text_from_image, extract_text_from_website
)
from utils.search import search_web
from utils.ai import generate_ai_response

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Setup Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "development-secret-key")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Configure upload folder to use /tmp in read-only file systems
app.config['UPLOAD_FOLDER'] = '/tmp/uploads'  # Change to /tmp
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Initialize Qdrant client
qdrant_client = QdrantService()

@app.route('/')
def index():
    """Render the main application page."""
    return render_template('index.html')

@app.route('/api/extract-content', methods=['POST'])
def extract_content():
    """Extract content from various sources."""
    try:
        source_type = request.form.get('source_type')
        content = ""

        if source_type == 'text':
            if 'file' not in request.files:
                return jsonify({"error": "No file provided"}), 400
            file = request.files['file']
            content = extract_text_from_file(file)
        
        elif source_type == 'pdf':
            if 'file' not in request.files:
                return jsonify({"error": "No file provided"}), 400
            file = request.files['file']
            content = extract_text_from_pdf(file)
        
        elif source_type == 'youtube':
            url = request.form.get('url')
            if not url:
                return jsonify({"error": "No URL provided"}), 400
            content = extract_text_from_youtube(url)
        
        elif source_type == 'audio':
            if 'file' not in request.files:
                return jsonify({"error": "No file provided"}), 400
            file = request.files['file']
            content = extract_text_from_audio(file)
        
        elif source_type == 'image':
            if 'file' not in request.files:
                return jsonify({"error": "No file provided"}), 400
            file = request.files['file']
            content = extract_text_from_image(file)
        
        elif source_type == 'website':
            url = request.form.get('url')
            if not url:
                return jsonify({"error": "No URL provided"}), 400
            content = extract_text_from_website(url)
        
        else:
            return jsonify({"error": "Invalid source type"}), 400

        return jsonify({"content": content})
    
    except Exception as e:
        logger.error(f"Error extracting content: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/store-document', methods=['POST'])
def store_document():
    """Store a document in the Qdrant collection."""
    try:
        data = request.json
        if not data or 'text' not in data:
            return jsonify({"error": "No text provided"}), 400
        
        metadata = {
            'title': data.get('title', 'Untitled Document'),
            'source_type': data.get('source_type', 'manual'),
            'source': data.get('source', 'User input')
        }
        
        document_data = {
            'text': data['text'],
            **metadata
        }
        
        doc_id = qdrant_client.add_document(document_data)
        return jsonify({"success": True, "id": doc_id})
    
    except Exception as e:
        logger.error(f"Error storing document: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/get-collection-stats', methods=['GET'])
def get_collection_stats():
    """Get statistics about the Qdrant collection."""
    try:
        stats = qdrant_client.get_collection_stats()
        
        # Calculate total storage size based on document metadata
        documents = qdrant_client.list_documents(limit=1000)  # Adjust limit if you have more documents
        
        total_size = 0
        for doc in documents:
            if doc.get('payload') and doc['payload'].get('size'):
                total_size += doc['payload'].get('size', 0)
        
        stats['total_size'] = total_size
        stats['total_size_formatted'] = format_file_size(total_size)
        
        return jsonify(stats)
    
    except Exception as e:
        logger.error(f"Error getting collection stats: {str(e)}")
        return jsonify({"error": str(e)}), 500

def format_file_size(size_bytes):
    """Format bytes to human readable size."""
    if size_bytes == 0:
        return "0B"
    
    size_names = ("B", "KB", "MB", "GB", "TB")
    i = 0
    while size_bytes >= 1024 and i < len(size_names) - 1:
        size_bytes /= 1024
        i += 1
    
    return f"{size_bytes:.2f} {size_names[i]}"

@app.route('/api/get-documents', methods=['GET'])
def get_documents():
    """Get documents from the Qdrant collection."""
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 5))
        
        offset = (page - 1) * per_page
        documents = qdrant_client.list_documents(limit=per_page, offset=offset)
        
        collection_stats = qdrant_client.get_collection_stats()
        total_documents = collection_stats.get('vectors_count', 0)
        
        return jsonify({
            "documents": documents,
            "total": total_documents,
            "page": page,
            "per_page": per_page,
            "total_pages": (total_documents + per_page - 1) // per_page
        })
    
    except Exception as e:
        logger.error(f"Error getting documents: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/delete-document/<doc_id>', methods=['DELETE'])
def delete_document(doc_id):
    """Delete a document from the Qdrant collection."""
    try:
        success = qdrant_client.delete_document(doc_id)
        if success:
            return jsonify({"success": True})
        else:
            return jsonify({"error": "Failed to delete document"}), 500
    
    except Exception as e:
        logger.error(f"Error deleting document: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/delete-selected-documents', methods=['POST'])
def delete_selected_documents():
    """Delete multiple documents from the Qdrant collection."""
    try:
        data = request.json
        if not data or 'ids' not in data:
            return jsonify({"error": "No document IDs provided"}), 400
        
        doc_ids = data['ids']
        success_count = 0
        
        for doc_id in doc_ids:
            if qdrant_client.delete_document(doc_id):
                success_count += 1
        
        return jsonify({
            "success": True,
            "deleted_count": success_count,
            "total_requested": len(doc_ids)
        })
    
    except Exception as e:
        logger.error(f"Error deleting documents: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/chat', methods=['POST'])
def chat():
    """Process a chat message and return an AI response with citations."""
    try:
        data = request.json
        if not data or 'message' not in data:
            return jsonify({"error": "No message provided"}), 400
        
        message = data['message']
        use_knowledge_search = data.get('use_knowledge_search', True)
        use_web_search = data.get('use_web_search', False)
        
        # Query knowledge base if enabled
        knowledge_results = []
        if use_knowledge_search:
            knowledge_results = qdrant_client.query(message, limit=3)
        
        # Query web search if enabled
        web_results = []
        if use_web_search:
            web_results = search_web(message)
        
        # Generate AI response with citations
        ai_response = generate_ai_response(
            message, 
            knowledge_results=knowledge_results, 
            web_results=web_results
        )
        
        return jsonify({
            "response": ai_response['response'],
            "citations": ai_response['citations']
        })
    
    except Exception as e:
        logger.error(f"Error processing chat message: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Not found"}), 404

@app.errorhandler(500)
def server_error(error):
    return jsonify({"error": "Server error"}), 500
